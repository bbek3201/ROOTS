'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildFamilyIndex, collectDescendants, getParentEdges } from '@/lib/relationships/graph';
import { computeRelationship } from '@/lib/relationships/path';
import { generationWindow } from '@/lib/relationships/generation';
import { getKinshipLocale } from '@/lib/kinship';
import { layoutFamilyTree, type TreeLayout, type TreeUnit } from '@/lib/tree/layout';
import type { CoupleNode, FamilyGraph, PersonNode } from '@/lib/relationships/types';
import { displayName, lifespan, yearOf } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The family tree.
 *
 * Everything on this canvas is arranged around one claim: a family is built out
 * of COUPLES, not out of individuals. So a couple is drawn as a large
 * photographic plate with both faces in it; a person who has not formed a
 * couple is a smaller, quieter card; and the day they marry, their card becomes
 * a couple plate in the same place in the tree. Reading down the canvas is
 * therefore reading the actual grammar of a family — couple, children, couple,
 * children — without anyone having to explain it.
 *
 * The cards are HTML rather than SVG on purpose. This screen lives or dies on
 * photography, and real <img> elements inside a transformed layer give us
 * object-fit, lazy loading and the same warm empty state as the rest of the
 * album. Only the branches — which must be curves, not org-chart elbows — are
 * drawn in SVG underneath.
 *
 * Pan and zoom are owned here rather than delegated to a charting library: the
 * whole interaction is a single transform, and owning it means a pinch on a
 * phone behaves like the rest of the OS instead of like a web chart.
 */

/** Everything the archive knows about one couple, for the detail panel. */
export interface CoupleArchive {
  stories: number;
  photos: number;
  recordings: number;
  /** A few signed photograph URLs — the memory preview inside the panel. */
  previews: string[];
}

interface Props {
  graph: FamilyGraph;
  /** The person the viewer IS, used for "how am I related to them?". */
  focusPersonId: string | null;
  locale?: string;
  visibleGenerations?: number;
  onOpenPerson?: (personId: string) => void;
  onOpenCouple?: (coupleId: string) => void;
  /** personId → signed URL of their portrait. The tree is faces, not boxes. */
  photoUrls?: Record<string, string>;
  /** coupleId → what that couple has in the archive. */
  coupleArchive?: Record<string, CoupleArchive>;
  /** Editors get the controls that grow the tree; everyone else just reads. */
  canEdit?: boolean;
}

const MIN_SCALE = 0.18;
const MAX_SCALE = 1.6;
/**
 * Air around the tree when it is fitted.
 *
 * Not symmetrical: the search sits over the top of the canvas and the
 * generation rail over the bottom, so a tree fitted with equal padding tucks
 * its oldest and youngest generations underneath them.
 */
const FIT_INSET = { top: 104, bottom: 112, side: 72 };
/**
 * Below this scale a card stops being a photograph and becomes a speck: a
 * couple plate drawn at 0.3 is still about 90 points wide, which reads as two
 * faces; much under that and the tree is a diagram of rectangles.
 */
const LEGIBLE_SCALE = 0.3;

export function FamilyTree({
  graph,
  focusPersonId,
  locale = 'mn',
  visibleGenerations = 7,
  onOpenPerson,
  onOpenCouple,
  photoUrls = {},
  coupleArchive = {},
  canEdit = false,
}: Props) {
  const index = useMemo(() => buildFamilyIndex(graph), [graph]);
  const kinship = useMemo(() => getKinshipLocale(locale), [locale]);

  const allGenerations = useMemo(() => {
    const values = [...index.people.values()].map((person) => person.generation ?? 1);
    return values.length > 0
      ? { min: Math.min(...values), max: Math.max(...values) }
      : { min: 1, max: 1 };
  }, [index]);

  const [window_, setWindow] = useState(() =>
    generationWindow(allGenerations.min, allGenerations.min, allGenerations.max, visibleGenerations),
  );
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // The canvas normally sits framed on the page, under the family's cover
  // photograph. Full screen is for the moment someone stops glancing at the
  // tree and starts reading it.
  const [fullscreen, setFullscreen] = useState(false);

  // --- what a collapsed branch folds away ----------------------------------
  const hiddenPersonIds = useMemo(
    () => collectHidden(index, [...collapsed]),
    [index, collapsed],
  );

  const descendantCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of index.people.values()) {
      counts.set(person.id, collectDescendants(index, person.id).size);
    }
    return counts;
  }, [index]);

  const layout = useMemo<TreeLayout>(
    () =>
      layoutFamilyTree(index, {
        fromGeneration: window_.from,
        toGeneration: window_.to,
        hiddenPersonIds,
      }),
    [index, window_.from, window_.to, hiddenPersonIds],
  );

  // --- viewport -------------------------------------------------------------
  const stageRef = useRef<HTMLDivElement>(null);
  // Zero until the canvas has been measured: fitting the tree against a
  // guessed viewport lands it at the wrong scale and, because the fit only
  // happens once, it stays there.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.7 });
  const [panning, setPanning] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; k: number; midX: number; midY: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * Bring a rectangle of the canvas into the middle of the screen.
   *
   * "The middle" means the middle of what the reader can actually see: on a
   * desktop the detail panel occupies the right of the viewport, so the
   * available centre moves left by half its width. Without that, selecting a
   * couple slides it neatly underneath the panel describing it.
   */
  const frame = useCallback(
    (
      box: { x: number; y: number; width: number; height: number },
      maxScale = 1,
      insetRight = 0,
    ) => {
      if (box.width <= 0 || box.height <= 0) return;
      const usableWidth = Math.max(viewport.width - insetRight, 240);
      const scale = Math.min(
        (usableWidth - FIT_INSET.side * 2) / box.width,
        (viewport.height - FIT_INSET.top - FIT_INSET.bottom) / box.height,
        maxScale,
      );
      const k = Math.max(MIN_SCALE, Math.min(scale, MAX_SCALE));
      // The vertical centre of the free space, which is above the true centre
      // of the viewport because the rail takes more room than the search does.
      const centreY = FIT_INSET.top + (viewport.height - FIT_INSET.top - FIT_INSET.bottom) / 2;
      setTransform({
        k,
        x: usableWidth / 2 - (box.x + box.width / 2) * k,
        y: centreY - (box.y + box.height / 2) * k,
      });
    },
    [viewport.width, viewport.height],
  );

  const fitToView = useCallback(() => {
    const { minX, minY, width, height } = layout.bounds;
    frame({ x: minX, y: minY, width, height }, 0.92);
  }, [frame, layout.bounds]);

  /** How much of the viewport the open detail panel takes on this screen. */
  const panelInset = useCallback(
    (open: boolean) => (open && viewport.width >= 640 ? 392 : 0),
    [viewport.width],
  );

  const focusUnit = useCallback(
    (unitId: string, withPanel = false) => {
      const unit = layout.unitsById.get(unitId);
      if (!unit) return;
      // A couple and the row of children under it, so focusing answers "who
      // came from these two?" rather than isolating the card.
      const children = unit.childUnitIds
        .map((id) => layout.unitsById.get(id))
        .filter((child): child is TreeUnit => child !== undefined);
      const boxes = [unit, ...children];
      const x = Math.min(...boxes.map((box) => box.x));
      const right = Math.max(...boxes.map((box) => box.x + box.width));
      const bottom = Math.max(...boxes.map((box) => box.y + box.height));
      frame({ x, y: unit.y, width: right - x, height: bottom - unit.y }, 1, panelInset(withPanel));
    },
    [frame, layout.unitsById, panelInset],
  );

  const focusGeneration = useCallback(
    (generation: number) => {
      let active = layout;
      if (generation < window_.from || generation > window_.to) {
        const next = generationWindow(generation, allGenerations.min, allGenerations.max, visibleGenerations);
        setWindow(next);
        active = layoutFamilyTree(index, {
          fromGeneration: next.from,
          toGeneration: next.to,
          hiddenPersonIds,
        });
      }
      const row = active.units.filter((unit) => unit.generation === generation);
      if (row.length === 0) return;
      const x = Math.min(...row.map((unit) => unit.x));
      const right = Math.max(...row.map((unit) => unit.x + unit.width));
      const y = Math.min(...row.map((unit) => unit.y));
      const bottom = Math.max(...row.map((unit) => unit.y + unit.height));
      frame({ x, y, width: right - x, height: bottom - y }, 0.85);
    },
    [layout, window_.from, window_.to, allGenerations, visibleGenerations, index, hiddenPersonIds, frame],
  );

  /**
   * The opening view.
   *
   * The whole shape of the family, when the whole shape still reads: seeing it
   * is the reason anyone opened this screen. But a phone fitting seven
   * generations across 400 points produces cards the size of postage stamps,
   * which is worse than showing less. Below that legibility floor the canvas
   * opens on the founding couple instead, at a size where their faces are
   * faces, and the family is explored downward from there.
   */
  const hasFitted = useRef(false);
  useEffect(() => {
    if (hasFitted.current || viewport.width < 50 || viewport.height < 50) return;
    if (layout.units.length === 0) return;
    hasFitted.current = true;

    const { width, height } = layout.bounds;
    const fitScale = Math.min(
      (viewport.width - FIT_INSET.side * 2) / width,
      (viewport.height - FIT_INSET.top - FIT_INSET.bottom) / height,
    );

    if (fitScale >= LEGIBLE_SCALE) {
      fitToView();
      return;
    }

    // The founding couple and the children under them: the smallest piece of
    // this tree that still says what kind of picture this is.
    const root = layout.units
      .filter((unit) => unit.generation === allGenerations.min)
      .sort((a, b) => b.childUnitIds.length - a.childUnitIds.length)[0];

    if (root) focusUnit(root.id);
    else focusGeneration(allGenerations.min);
  }, [
    viewport.width,
    viewport.height,
    layout.bounds,
    layout.units,
    fitToView,
    focusUnit,
    focusGeneration,
    allGenerations.min,
  ]);

  // --- pointer interaction --------------------------------------------------
  // Dragging works from anywhere on the canvas, cards included — grabbing a
  // photograph to move the tree is the natural gesture, and a card that
  // swallowed it would make half the surface dead to panning. A drag that
  // started on a card simply does not count as a click on it.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged.current = false;
    setPanning(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = [...pointers.current.values()];

    if (active.length === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      // The pointer is only captured once a real drag has begun. Capturing on
      // pointerdown would redirect the following click to the canvas, and a
      // card that cannot be tapped is worse than a drag that ends at the edge.
      if (!dragged.current) {
        if (Math.abs(dx) + Math.abs(dy) <= 2) return;
        dragged.current = true;
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      }
      setTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
      return;
    }

    if (active.length >= 2) {
      const [a, b] = active as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      if (!pinchStart.current) {
        pinchStart.current = { distance, k: transform.k, midX, midY };
        return;
      }
      const ratio = distance / (pinchStart.current.distance || 1);
      const k = clampScale(pinchStart.current.k * ratio);
      setTransform((current) => zoomAround(current, k, midX, midY, stageRef.current));
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) setPanning(false);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    // A trackpad pinch arrives as a ctrl-wheel; a two-finger scroll pans.
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.0022);
      setTransform((current) =>
        zoomAround(current, clampScale(current.k * factor), event.clientX, event.clientY, stageRef.current),
      );
      return;
    }
    setTransform((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
  };

  const zoomBy = (factor: number) => {
    setTransform((current) => {
      const k = clampScale(current.k * factor);
      const ratio = k / current.k;
      return {
        k,
        x: viewport.width / 2 - (viewport.width / 2 - current.x) * ratio,
        y: viewport.height / 2 - (viewport.height / 2 - current.y) * ratio,
      };
    });
  };

  // --- selection ------------------------------------------------------------
  const selectedUnit = selectedUnitId ? layout.unitsById.get(selectedUnitId) ?? null : null;

  const selectUnit = (unit: TreeUnit, personId?: string) => {
    if (dragged.current) return;
    setSelectedUnitId(unit.id);
    setSelectedPersonId(personId ?? unit.anchorId);
    focusUnit(unit.id, true);
  };

  const closePanel = () => {
    setSelectedUnitId(null);
    setSelectedPersonId(null);
  };

  const toggleCollapse = (unit: TreeUnit) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(unit.anchorId)) next.delete(unit.anchorId);
      else next.add(unit.anchorId);
      return next;
    });
  };

  // --- relationship highlighting -------------------------------------------
  const relationship = useMemo(() => {
    if (!focusPersonId || !selectedPersonId || focusPersonId === selectedPersonId) return null;
    const result = computeRelationship(index, focusPersonId, selectedPersonId);
    if (result.descriptor.kind === 'unrelated') return { result, term: kinship.unknown };
    return { result, term: kinship.describe(result.descriptor) };
  }, [index, focusPersonId, selectedPersonId, kinship]);

  const highlighted = useMemo(() => {
    const ids = new Set<string>();
    for (const step of relationship?.result.path ?? []) ids.add(step.personId);
    return ids;
  }, [relationship]);

  // --- search ---------------------------------------------------------------
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('mn-MN');
    if (term.length < 1) return [];
    return [...index.people.values()]
      .filter((person) =>
        `${person.first_name} ${person.last_name ?? ''} ${person.nickname ?? ''}`
          .toLocaleLowerCase('mn-MN')
          .includes(term),
      )
      .slice(0, 7);
  }, [index, query]);

  const jumpToPerson = (personId: string) => {
    const person = index.people.get(personId);
    if (!person) return;
    const generation = person.generation ?? 1;

    // A person in a generation that is not on screen needs the window moved
    // first — and the layout of that window computed here rather than a render
    // later, so the canvas arrives already pointing at them.
    let active = layout;
    if (generation < window_.from || generation > window_.to) {
      const next = generationWindow(generation, allGenerations.min, allGenerations.max, visibleGenerations);
      setWindow(next);
      active = layoutFamilyTree(index, {
        fromGeneration: next.from,
        toGeneration: next.to,
        hiddenPersonIds,
      });
    }

    setQuery('');

    const unit = active.unitsById.get(active.unitByPerson.get(personId) ?? '');
    if (!unit) return;
    setSelectedUnitId(unit.id);
    setSelectedPersonId(personId);

    const children = unit.childUnitIds
      .map((id) => active.unitsById.get(id))
      .filter((child): child is TreeUnit => child !== undefined);
    const boxes = [unit, ...children];
    const x = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    frame({ x, y: unit.y, width: right - x, height: bottom - unit.y }, 1, panelInset(true));
  };

  const generations = useMemo(() => {
    const list: number[] = [];
    for (let g = allGenerations.min; g <= allGenerations.max; g += 1) list.push(g);
    return list;
  }, [allGenerations]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((current) => {
      // The viewport is about to change shape, so the opening fit has to be
      // allowed to happen again — otherwise the tree stays framed for a window
      // that is no longer there.
      hasFitted.current = false;
      return !current;
    });
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, toggleFullscreen]);

  return (
    <div
      className={cn(
        'overflow-hidden',
        fullscreen ? 'fixed inset-0 z-50 bg-[#fffcf8]' : 'relative h-full w-full',
      )}
    >
      <div
        ref={stageRef}
        className={cn(
          'absolute inset-0 touch-none select-none',
          panning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        role="application"
        aria-label="Гэр бүлийн мод"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        {layout.units.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-[color-mix(in_srgb,#183b32_55%,transparent)]">
            Энэ үеийн хүмүүс хараахан бүртгэгдээгүй байна.
          </p>
        ) : (
          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.k})` }}
          >
            <Branches layout={layout} highlighted={highlighted} />

            {layout.units.map((unit) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                index={index}
                photoUrls={photoUrls}
                focusPersonId={focusPersonId}
                selected={selectedUnitId === unit.id}
                highlighted={highlighted}
                collapsed={collapsed.has(unit.anchorId)}
                hiddenBelow={countBelow(index, unit, descendantCounts)}
                onSelect={selectUnit}
                onToggleCollapse={toggleCollapse}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- floating chrome ---- */}
      <TreeSearch query={query} onQueryChange={setQuery} matches={matches} onPick={jumpToPerson} />

      <ViewControls
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={fitToView}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        canCollapseAll={collapsed.size > 0}
        onExpandAll={() => setCollapsed(new Set())}
      />

      <GenerationRail
        generations={generations}
        window={window_}
        onPick={focusGeneration}
      />

      {selectedUnit ? (
        <DetailPanel
          key={selectedUnit.id}
          unit={selectedUnit}
          index={index}
          photoUrls={photoUrls}
          archive={coupleArchive}
          canEdit={canEdit}
          relationshipLabel={relationship?.term.label ?? null}
          relationshipNote={relationship?.term.note ?? null}
          chain={
            relationship?.result.path.map((step, position) => ({
              id: step.personId,
              name: displayName(index.people.get(step.personId)),
              term: position === 0 ? kinship.self : kinship.describe(step.descriptor).label,
            })) ?? []
          }
          onOpenPerson={onOpenPerson}
          onOpenCouple={onOpenCouple}
          onClose={closePanel}
        />
      ) : null}
    </div>
  );
}

/* ===========================================================================
   Cards
   =========================================================================== */

function UnitCard({
  unit,
  index,
  photoUrls,
  focusPersonId,
  selected,
  highlighted,
  collapsed,
  hiddenBelow,
  onSelect,
  onToggleCollapse,
}: {
  unit: TreeUnit;
  index: ReturnType<typeof buildFamilyIndex>;
  photoUrls: Record<string, string>;
  focusPersonId: string | null;
  selected: boolean;
  highlighted: Set<string>;
  collapsed: boolean;
  hiddenBelow: number;
  onSelect: (unit: TreeUnit, personId?: string) => void;
  onToggleCollapse: (unit: TreeUnit) => void;
}) {
  const anchor = index.people.get(unit.anchorId);
  if (!anchor) return null;

  const members = [anchor, ...unit.partners.map((partner) => index.people.get(partner.personId))].filter(
    (person): person is PersonNode => person !== undefined,
  );
  const couple = unit.partners[0] ? index.couples.get(unit.partners[0].coupleId) ?? null : null;
  const onPath = members.some((person) => highlighted.has(person.id));
  const isViewer = members.some((person) => person.id === focusPersonId);
  const childCount = countChildren(index, unit);
  const hasChildren = childCount > 0;

  return (
    <div
      className="absolute"
      style={{ left: unit.x, top: unit.y, width: unit.width, height: unit.height }}
    >
      <button
        type="button"
        data-card
        onClick={() => onSelect(unit)}
        aria-label={members.map((person) => displayName(person)).join(' ба ')}
        className={cn(
          'group relative block h-full w-full overflow-hidden rounded-[22px] text-left',
          'border bg-[#fffcf8] transition-[transform,box-shadow,border-color] duration-500 ease-out',
          'hover:-translate-y-[3px]',
          selected
            ? 'border-[#183b32] shadow-[0_28px_60px_-32px_rgba(24,59,50,0.55)]'
            : onPath
              ? 'border-[color-mix(in_srgb,#183b32_38%,transparent)] shadow-[0_18px_44px_-30px_rgba(24,59,50,0.5)]'
              : 'border-[color-mix(in_srgb,#183b32_14%,transparent)] shadow-[0_14px_36px_-28px_rgba(24,59,50,0.45)] hover:shadow-[0_26px_56px_-30px_rgba(24,59,50,0.5)]',
        )}
      >
        {/* Photography first: the plate fills the top of the card. */}
        <div className={cn('flex gap-[3px] bg-[#f2ece1]', unit.kind === 'couple' ? 'h-[196px]' : 'h-[150px]')}>
          {members.map((person) => (
            <Portrait key={person.id} person={person} src={photoUrls[person.id]} />
          ))}
        </div>

        <div className="px-4 pt-3.5">
          <p
            className={cn(
              'truncate font-display leading-tight tracking-[-0.03em] text-[#183b32]',
              unit.kind === 'couple' ? 'text-[1.06rem]' : 'text-[0.98rem]',
            )}
          >
            {unit.kind === 'couple'
              ? members.map((person) => displayName(person)).join(' & ')
              : displayName(anchor)}
          </p>

          <p className="mt-1 truncate text-[0.74rem] text-[color-mix(in_srgb,#183b32_52%,transparent)]">
            {unit.kind === 'couple' ? togetherSince(couple) : lifespan(anchor) || 'Он тодорхойгүй'}
          </p>

          {unit.kind === 'couple' && childCount > 0 ? (
            <p className="mt-2 text-[0.68rem] uppercase tracking-[0.16em] text-[color-mix(in_srgb,#183b32_40%,transparent)]">
              {childCount} хүүхэд
            </p>
          ) : null}
        </div>

        {isViewer ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#fffcf8]/92 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#183b32] backdrop-blur">
            Та
          </span>
        ) : null}

        {/* The interaction indicator: nothing until the pointer arrives. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3.5 right-4 text-[#183b32] opacity-0 transition-opacity duration-300 group-hover:opacity-40"
        >
          →
        </span>
      </button>

      {hasChildren || hiddenBelow > 0 ? (
        <button
          type="button"
          data-card
          onClick={() => onToggleCollapse(unit)}
          aria-label={collapsed ? 'Салааг дэлгэх' : 'Салааг эвхэх'}
          aria-expanded={!collapsed}
          className={cn(
            'absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2.5 rounded-full px-3 py-1.5',
            'text-[0.7rem] tracking-[0.04em] backdrop-blur transition-colors',
            collapsed
              ? 'bg-[#183b32] text-[#fbf9f4]'
              : 'bg-[#fffcf8]/88 text-[color-mix(in_srgb,#183b32_60%,transparent)] hover:text-[#183b32]',
          )}
        >
          {collapsed ? `+${hiddenBelow || childCount}` : '⌄'}
        </button>
      ) : null}
    </div>
  );
}

function Portrait({ person, src }: { person: PersonNode; src?: string }) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-gradient-to-br from-[#f2ece1] to-[#bdd0c2]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL.
        <img
          src={src}
          alt={displayName(person)}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-display text-[2.4rem] text-[color-mix(in_srgb,#183b32_36%,transparent)]"
        >
          {displayName(person).slice(0, 1)}
        </span>
      )}
      {person.life_status === 'deceased' ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-[color-mix(in_srgb,#183b32_35%,transparent)]"
        />
      ) : null}
    </div>
  );
}

/* ===========================================================================
   Branches
   =========================================================================== */

/**
 * The lines between generations.
 *
 * Deliberately not org-chart elbows: each child hangs from its parents on a
 * single soft cubic curve, hairline weight, in the same green as the text at
 * low opacity. At a glance it reads as a branch rather than as a wire.
 */
function Branches({ layout, highlighted }: { layout: TreeLayout; highlighted: Set<string> }) {
  const pad = 200;
  const { minX, minY, width, height } = layout.bounds;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: minX - pad, top: minY - pad, width: width + pad * 2, height: height + pad * 2 }}
      width={width + pad * 2}
      height={height + pad * 2}
    >
      <g transform={`translate(${pad - minX} ${pad - minY})`} fill="none" strokeLinecap="round">
        {layout.units.map((unit) => {
          const children = unit.childUnitIds
            .map((id) => layout.unitsById.get(id))
            .filter((child): child is TreeUnit => child !== undefined && child.parentUnitId === unit.id);
          if (children.length === 0) return null;

          const startX = unit.x + unit.width / 2;
          const startY = unit.y + unit.height;

          return children.map((child) => {
            const endX = child.x + child.width / 2;
            const endY = child.y;
            const active = highlighted.has(unit.anchorId) && highlighted.has(child.anchorId);
            return (
              <path
                key={`${unit.id}->${child.id}`}
                d={branch(startX, startY, endX, endY)}
                stroke={active ? '#183b32' : 'color-mix(in srgb, #183b32 22%, transparent)'}
                strokeWidth={active ? 1.9 : 1.15}
              />
            );
          });
        })}

        {/* A marriage between two people who each descend from this family. */}
        {layout.crossLinks.map((link) => {
          const from = layout.unitsById.get(link.fromUnitId);
          const to = layout.unitsById.get(link.toUnitId);
          if (!from || !to) return null;
          const [left, right] = from.x <= to.x ? [from, to] : [to, from];
          const y = left.y + 96;
          return (
            <path
              key={`cross:${link.coupleId}`}
              d={`M ${left.x + left.width} ${y} C ${left.x + left.width + 28} ${y - 22}, ${right.x - 28} ${y - 22}, ${right.x} ${y}`}
              stroke="color-mix(in srgb, #b4574c 42%, transparent)"
              strokeWidth={1.2}
              strokeDasharray="2 6"
            />
          );
        })}
      </g>
    </svg>
  );
}

/** One soft S-curve from a couple down to a child. */
function branch(startX: number, startY: number, endX: number, endY: number): string {
  if (Math.abs(endX - startX) < 1) return `M ${startX} ${startY} V ${endY}`;
  const drop = (endY - startY) * 0.55;
  return `M ${startX} ${startY} C ${startX} ${startY + drop}, ${endX} ${endY - drop}, ${endX} ${endY}`;
}

/* ===========================================================================
   Chrome
   =========================================================================== */

function TreeSearch({
  query,
  onQueryChange,
  matches,
  onPick,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  matches: PersonNode[];
  onPick: (personId: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 pr-[4.5rem] sm:p-6 sm:pr-24">
      <div className="pointer-events-auto relative w-full max-w-sm sm:max-w-xs">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Хүн хайх"
          aria-label="Гэр бүлийн модноос хайх"
          className="h-12 w-full rounded-full border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8]/90 px-5 text-[16px] text-[#183b32] shadow-[0_18px_40px_-30px_rgba(24,59,50,0.5)] backdrop-blur-xl placeholder:text-[color-mix(in_srgb,#183b32_42%,transparent)] focus:border-[color-mix(in_srgb,#183b32_30%,transparent)] focus:outline-none"
        />
        {matches.length > 0 ? (
          <ul className="absolute inset-x-0 top-14 overflow-hidden rounded-3xl border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8] p-1.5 shadow-[0_30px_60px_-30px_rgba(24,59,50,0.45)]">
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onPick(person.id)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors hover:bg-[#f7f2e9]"
                >
                  <span className="truncate text-[0.92rem] text-[#183b32]">{displayName(person)}</span>
                  <span className="shrink-0 text-[0.72rem] text-[color-mix(in_srgb,#183b32_45%,transparent)]">
                    {lifespan(person)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ViewControls({
  onZoomIn,
  onZoomOut,
  onFit,
  fullscreen,
  onToggleFullscreen,
  canCollapseAll,
  onExpandAll,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  canCollapseAll: boolean;
  onExpandAll: () => void;
}) {
  const button =
    'flex h-11 w-11 items-center justify-center text-[1rem] text-[color-mix(in_srgb,#183b32_66%,transparent)] transition-colors hover:text-[#183b32]';

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-2 sm:right-6 sm:top-6">
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8]/88 backdrop-blur-xl">
        <button type="button" onClick={onZoomIn} aria-label="Томруулах" className={button}>+</button>
        <span aria-hidden="true" className="mx-3 h-px bg-[color-mix(in_srgb,#183b32_10%,transparent)]" />
        <button type="button" onClick={onZoomOut} aria-label="Багасгах" className={button}>−</button>
        <span aria-hidden="true" className="mx-3 h-px bg-[color-mix(in_srgb,#183b32_10%,transparent)]" />
        <button type="button" onClick={onFit} aria-label="Бүх модыг харах" className={button}>⛶</button>
        <span aria-hidden="true" className="mx-3 h-px bg-[color-mix(in_srgb,#183b32_10%,transparent)]" />
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? 'Бүтэн дэлгэцээс гарах' : 'Бүтэн дэлгэц'}
          aria-pressed={fullscreen}
          className={button}
        >
          {fullscreen ? '✕' : '⤢'}
        </button>
      </div>

      {canCollapseAll ? (
        <button
          type="button"
          onClick={onExpandAll}
          className="pointer-events-auto rounded-full border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8]/88 px-4 py-2 text-[0.75rem] text-[color-mix(in_srgb,#183b32_65%,transparent)] backdrop-blur-xl transition-colors hover:text-[#183b32]"
        >
          Бүгдийг дэлгэх
        </button>
      ) : null}
    </div>
  );
}

/**
 * The generation rail.
 *
 * Seven generations will not fit on one screen at a readable size, and shrinking
 * the whole canvas until they do produces a diagram nobody can read. So the tree
 * keeps its scale and the rail moves the viewport instead: one tap takes the
 * screen to that generation.
 */
function GenerationRail({
  generations,
  window: activeWindow,
  onPick,
}: {
  generations: number[];
  window: { from: number; to: number };
  onPick: (generation: number) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:p-6">
      <div className="pointer-events-auto flex max-w-full items-center gap-4 overflow-x-auto rounded-full border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8]/88 px-5 py-2.5 backdrop-blur-xl no-scrollbar">
        <span className="hidden shrink-0 text-[0.62rem] uppercase tracking-[0.24em] text-[color-mix(in_srgb,#183b32_42%,transparent)] sm:block">
          Үе
        </span>
        <ul className="flex items-center gap-1">
          {generations.map((generation) => {
            const inWindow = generation >= activeWindow.from && generation <= activeWindow.to;
            return (
              <li key={generation}>
                <button
                  type="button"
                  onClick={() => onPick(generation)}
                  aria-label={`${generation}-р үе рүү очих`}
                  className={cn(
                    'flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-[0.82rem] tabular-nums transition-colors',
                    inWindow
                      ? 'text-[#183b32]'
                      : 'text-[color-mix(in_srgb,#183b32_38%,transparent)] hover:text-[#183b32]',
                  )}
                >
                  {String(generation).padStart(2, '0')}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ===========================================================================
   Detail panel
   =========================================================================== */

/**
 * What a family looks like from the inside.
 *
 * A panel rather than a page: the tree stays visible behind it, so opening a
 * couple never loses the reader's place in the family. It carries only what a
 * person actually asks at this moment — who these two are, how long they have
 * been together, who came from them, and what the archive holds about them.
 */
function DetailPanel({
  unit,
  index,
  photoUrls,
  archive,
  canEdit,
  relationshipLabel,
  relationshipNote,
  chain,
  onOpenPerson,
  onOpenCouple,
  onClose,
}: {
  unit: TreeUnit;
  index: ReturnType<typeof buildFamilyIndex>;
  photoUrls: Record<string, string>;
  archive: Record<string, CoupleArchive>;
  canEdit: boolean;
  relationshipLabel: string | null;
  relationshipNote: string | null;
  chain: Array<{ id: string; name: string; term: string }>;
  onOpenPerson?: (personId: string) => void;
  onOpenCouple?: (coupleId: string) => void;
  onClose: () => void;
}) {
  const anchor = index.people.get(unit.anchorId);
  if (!anchor) return null;

  const partners = unit.partners
    .map((partner) => ({ couple: index.couples.get(partner.coupleId), person: index.people.get(partner.personId) }))
    .filter((entry): entry is { couple: CoupleNode; person: PersonNode } =>
      entry.couple !== undefined && entry.person !== undefined,
    );

  const primary = partners[0] ?? null;
  const children = childrenOf(index, unit);
  const summary = primary ? archive[primary.couple.id] : undefined;

  return (
    <aside
      className={cn(
        'fade-up absolute z-30 overflow-y-auto border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8]/96 backdrop-blur-xl',
        'shadow-[0_40px_80px_-40px_rgba(24,59,50,0.5)]',
        // Phone: a sheet that leaves the tree visible above it.
        'inset-x-0 bottom-0 max-h-[62%] rounded-t-[28px] p-6 pb-24',
        // Desktop: a column beside the tree.
        'sm:inset-y-6 sm:left-auto sm:right-6 sm:max-h-none sm:w-[368px] sm:rounded-[28px] sm:pb-8',
      )}
      aria-label="Дэлгэрэнгүй"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{unit.generation}-р үе</p>
          <h2 className="mt-2 font-display text-[1.55rem] leading-tight tracking-[-0.035em] text-[#183b32]">
            {[anchor, ...partners.map((entry) => entry.person)].map((person) => displayName(person)).join(' & ')}
          </h2>
          <p className="mt-1.5 text-[0.85rem] text-[color-mix(in_srgb,#183b32_55%,transparent)]">
            {primary ? togetherSince(primary.couple) : lifespan(anchor) || 'Он тодорхойгүй'}
            {children.length > 0 ? ` · ${children.length} хүүхэд` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color-mix(in_srgb,#183b32_50%,transparent)] transition-colors hover:text-[#183b32]"
        >
          ✕
        </button>
      </div>

      {relationshipLabel ? (
        <div className="mt-5 rounded-2xl bg-[color-mix(in_srgb,#eef3ee_85%,transparent)] px-4 py-3">
          <p className="text-[0.9rem] text-[#183b32]">Таны {relationshipLabel.toLocaleLowerCase('mn-MN')}</p>
          {chain.length > 1 ? (
            <p className="mt-1 text-[0.75rem] leading-relaxed text-[color-mix(in_srgb,#183b32_58%,transparent)]">
              {chain.map((step) => `${step.term} (${step.name})`).join(' → ')}
            </p>
          ) : null}
          {relationshipNote ? (
            <p className="mt-1 text-[0.75rem] text-[color-mix(in_srgb,#183b32_45%,transparent)]">{relationshipNote}</p>
          ) : null}
        </div>
      ) : null}

      {/* ---- the people in this card ---- */}
      <ul className="mt-6 space-y-1.5">
        {[anchor, ...partners.map((entry) => entry.person)].map((person) => (
          <li key={person.id}>
            <button
              type="button"
              onClick={() => onOpenPerson?.(person.id)}
              className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-[#f7f2e9]"
            >
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#f7f2e9] to-[#cddbcf]">
                {photoUrls[person.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL.
                  <img src={photoUrls[person.id]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-[0.95rem] text-[color-mix(in_srgb,#183b32_40%,transparent)]">
                    {displayName(person).slice(0, 1)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.95rem] text-[#183b32]">{displayName(person)}</span>
                <span className="block truncate text-[0.75rem] text-[color-mix(in_srgb,#183b32_48%,transparent)]">
                  {[lifespan(person), person.occupation].filter(Boolean).join(' · ') || 'Мэдээлэл нэмэгдээгүй'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ---- what came from them ---- */}
      {children.length > 0 ? (
        <section className="mt-6">
          <p className="eyebrow">Хүүхдүүд</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onOpenPerson?.(child.id)}
                  className="rounded-full border border-[color-mix(in_srgb,#183b32_12%,transparent)] px-3.5 py-2 text-[0.82rem] text-[color-mix(in_srgb,#183b32_72%,transparent)] transition-colors hover:border-[#183b32] hover:text-[#183b32]"
                >
                  {displayName(child)}
                  {yearOf(child.birth_date) ? (
                    <span className="ml-1.5 text-[color-mix(in_srgb,#183b32_42%,transparent)]">
                      {yearOf(child.birth_date)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- the archive ---- */}
      {primary ? (
        <section className="mt-7">
          <p className="eyebrow">Дурсамжууд</p>

          {summary && summary.previews.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {summary.previews.slice(0, 3).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL.
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[0.82rem] text-[color-mix(in_srgb,#183b32_55%,transparent)]">
            {summary
              ? [
                  summary.stories > 0 ? `${summary.stories} түүх` : null,
                  summary.photos > 0 ? `${summary.photos} зураг` : null,
                  summary.recordings > 0 ? `${summary.recordings} бичлэг` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Энэ хосын архив хоосон байна.'
              : 'Энэ хосын архив хоосон байна.'}
          </p>

          <button
            type="button"
            onClick={() => onOpenCouple?.(primary.couple.id)}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[#183b32] text-[0.92rem] text-[#fbf9f4] transition-colors hover:bg-[#12302a]"
          >
            Хосын хуудас нээх
          </button>

          {canEdit ? (
            // The tree grows here or it does not grow at all: this is where
            // someone is looking when they remember a child is missing.
            <a
              href={`/couple/${primary.couple.id}#add-child`}
              className="mt-2.5 flex h-12 w-full items-center justify-center rounded-full border border-[color-mix(in_srgb,#183b32_14%,transparent)] text-[0.92rem] text-[color-mix(in_srgb,#183b32_72%,transparent)] transition-colors hover:border-[#183b32] hover:text-[#183b32]"
            >
              Хүүхэд нэмэх
            </a>
          ) : null}
        </section>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onOpenPerson?.(anchor.id)}
            className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-[#183b32] text-[0.92rem] text-[#fbf9f4] transition-colors hover:bg-[#12302a]"
          >
            Профайл нээх
          </button>
          {canEdit ? (
            <a
              href={`/person/${anchor.id}/edit`}
              className="mt-2.5 flex h-12 w-full items-center justify-center rounded-full border border-[color-mix(in_srgb,#183b32_14%,transparent)] text-[0.92rem] text-[color-mix(in_srgb,#183b32_72%,transparent)] transition-colors hover:border-[#183b32] hover:text-[#183b32]"
            >
              Мэдээлэл засах
            </a>
          ) : null}
        </>
      )}

      {partners.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {partners.slice(1).map((entry) => (
            <li key={entry.couple.id}>
              <button
                type="button"
                onClick={() => onOpenCouple?.(entry.couple.id)}
                className="rounded-full bg-[#f7f2e9] px-4 py-2 text-[0.8rem] text-[color-mix(in_srgb,#183b32_70%,transparent)] transition-colors hover:text-[#183b32]"
              >
                <span className="text-[#b4574c]">♥</span> {displayName(entry.person)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

/* ===========================================================================
   Helpers
   =========================================================================== */

function clampScale(k: number): number {
  return Math.max(MIN_SCALE, Math.min(k, MAX_SCALE));
}

/** Zoom about a screen point so the point under the cursor stays put. */
function zoomAround(
  current: { x: number; y: number; k: number },
  k: number,
  clientX: number,
  clientY: number,
  container: HTMLElement | null,
): { x: number; y: number; k: number } {
  const rect = container?.getBoundingClientRect();
  const px = clientX - (rect?.left ?? 0);
  const py = clientY - (rect?.top ?? 0);
  const ratio = k / current.k;
  return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
}

function togetherSince(couple: CoupleNode | null): string {
  if (!couple) return '';
  const start = yearOf(couple.marriage_date ?? couple.relationship_start);
  const end = yearOf(couple.relationship_end);
  if (!start) return couple.status === 'together' ? 'Хамтдаа' : '';
  if (end) return `${start} – ${end}`;
  return `${start} оноос хамтдаа`;
}

/** Everyone born to this unit's couples, oldest first, de-duplicated. */
function childrenOf(index: ReturnType<typeof buildFamilyIndex>, unit: TreeUnit): PersonNode[] {
  const seen = new Set<string>();
  const children: PersonNode[] = [];
  for (const memberId of [unit.anchorId, ...unit.partners.map((partner) => partner.personId)]) {
    for (const edge of index.childEdges.get(memberId) ?? []) {
      if (seen.has(edge.child_id)) continue;
      const child = index.people.get(edge.child_id);
      if (!child) continue;
      seen.add(child.id);
      children.push(child);
    }
  }
  return children.sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1);
}

function countChildren(index: ReturnType<typeof buildFamilyIndex>, unit: TreeUnit): number {
  return childrenOf(index, unit).length;
}

/** How many people a collapsed card is holding out of sight. */
function countBelow(
  index: ReturnType<typeof buildFamilyIndex>,
  unit: TreeUnit,
  counts: Map<string, number>,
): number {
  const members = [unit.anchorId, ...unit.partners.map((partner) => partner.personId)];
  return Math.max(...members.map((id) => counts.get(id) ?? 0), 0);
}

/**
 * The people inside collapsed branches.
 *
 * Descendants, plus the partners who married into them — leaving a married-in
 * spouse behind would strand them as a root of their own, which is worse than
 * hiding one person too many. Someone who has parents of their own elsewhere in
 * the tree is never hidden: their branch is not the one that was folded.
 */
function collectHidden(
  index: ReturnType<typeof buildFamilyIndex>,
  anchorIds: string[],
): Set<string> {
  const hidden = new Set<string>();
  if (anchorIds.length === 0) return hidden;

  const queue: string[] = [];
  const add = (personId: string) => {
    if (hidden.has(personId)) return;
    hidden.add(personId);
    queue.push(personId);
  };

  for (const anchorId of anchorIds) {
    const unitMembers = [anchorId];
    for (const couple of index.couplesByPerson.get(anchorId) ?? []) {
      const other = couple.person_a_id === anchorId ? couple.person_b_id : couple.person_a_id;
      if (other) unitMembers.push(other);
    }
    for (const memberId of unitMembers) {
      for (const edge of index.childEdges.get(memberId) ?? []) add(edge.child_id);
    }
  }

  while (queue.length > 0) {
    const personId = queue.pop() as string;
    for (const edge of index.childEdges.get(personId) ?? []) add(edge.child_id);
    for (const couple of index.couplesByPerson.get(personId) ?? []) {
      const other = couple.person_a_id === personId ? couple.person_b_id : couple.person_a_id;
      if (other && getParentEdges(index, other).length === 0) add(other);
    }
  }

  return hidden;
}
