'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildFamilyIndex } from '@/lib/relationships/graph';
import { computeRelationship } from '@/lib/relationships/path';
import { generationWindow } from '@/lib/relationships/generation';
import { getKinshipLocale } from '@/lib/kinship';
import {
  layoutFamilyTree,
  NODE_HEIGHT,
  NODE_WIDTH,
  PARTNER_GAP,
  ROW_HEIGHT,
  type TreeLayout,
  type TreeUnit,
} from '@/lib/tree/layout';
import type { FamilyGraph } from '@/lib/relationships/types';
import { displayName, lifespan } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The interactive family tree.
 *
 * Pan and zoom are implemented directly on pointer events rather than with a
 * charting library: the whole interaction is a single transform, and owning it
 * means pinch-zoom on a phone behaves exactly like the rest of the OS instead
 * of like a web chart.
 *
 * The tree shows a seven-generation window at a time. Generations outside it
 * are NOT deleted or hidden away — the controls above the canvas say how many
 * older generations are in the archive and step into them.
 */

interface Props {
  graph: FamilyGraph;
  /** The person the viewer IS, used for "how am I related to them?". */
  focusPersonId: string | null;
  locale?: string;
  visibleGenerations?: number;
  onOpenPerson?: (personId: string) => void;
  /** The heart between two portraits opens their couple. */
  onOpenCouple?: (coupleId: string) => void;
  /** personId → signed URL of their portrait. The tree is faces, not boxes. */
  photoUrls?: Record<string, string>;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.4;

export function FamilyTree({
  graph,
  focusPersonId,
  locale = 'mn',
  visibleGenerations = 7,
  onOpenPerson,
  onOpenCouple,
  photoUrls = {},
}: Props) {
  const index = useMemo(() => buildFamilyIndex(graph), [graph]);
  const kinship = useMemo(() => getKinshipLocale(locale), [locale]);

  const allGenerations = useMemo(() => {
    const values = [...index.people.values()].map((person) => person.generation ?? 1);
    return values.length > 0
      ? { min: Math.min(...values), max: Math.max(...values) }
      : { min: 1, max: 1 };
  }, [index]);

  const focusGeneration = focusPersonId
    ? index.people.get(focusPersonId)?.generation ?? allGenerations.max
    : allGenerations.max;

  const [window_, setWindow] = useState(() =>
    generationWindow(focusGeneration, allGenerations.min, allGenerations.max, visibleGenerations),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const layout = useMemo<TreeLayout>(
    () => layoutFamilyTree(index, { fromGeneration: window_.from, toGeneration: window_.to }),
    [index, window_.from, window_.to],
  );

  // --- viewport -------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 360, height: 480 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; k: number; midX: number; midY: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitToView = useCallback(() => {
    const { width, height, minX, minY } = layout.bounds;
    if (width <= 0 || height <= 0) return;
    const padding = 32;
    const scale = Math.min(
      (viewport.width - padding * 2) / width,
      (viewport.height - padding * 2) / height,
      1.1,
    );
    const k = Math.max(MIN_SCALE, Math.min(scale, MAX_SCALE));
    setTransform({
      x: viewport.width / 2 - (minX + width / 2) * k,
      y: viewport.height / 2 - (minY + height / 2) * k,
      k,
    });
  }, [layout.bounds, viewport.width, viewport.height]);

  const centreOn = useCallback(
    (personId: string, scale?: number) => {
      const position = layout.personPositions.get(personId);
      if (!position) return;
      setTransform((current) => {
        const k = Math.max(MIN_SCALE, Math.min(scale ?? current.k, MAX_SCALE));
        return {
          k,
          x: viewport.width / 2 - (position.x + NODE_WIDTH / 2) * k,
          y: viewport.height / 2 - (position.y + NODE_HEIGHT / 2) * k,
        };
      });
    },
    [layout.personPositions, viewport.width, viewport.height],
  );

  // The opening view, once the canvas has a real size.
  //
  // Whole family first: seeing the shape of it is the reason someone opened
  // this screen, and landing mid-canvas with a generation cropped off the top
  // reads as a broken page rather than as a map. Only when the tree is too big
  // to fit legibly do we fall back to centring on the viewer, which at least
  // starts them somewhere they recognise.
  const hasFitted = useRef(false);
  useEffect(() => {
    if (hasFitted.current || viewport.width < 50) return;
    hasFitted.current = true;

    const { width, height } = layout.bounds;
    const fitScale = Math.min((viewport.width - 64) / width, (viewport.height - 64) / height);

    if (fitScale >= 0.5 || !focusPersonId || !layout.personPositions.has(focusPersonId)) {
      fitToView();
    } else {
      centreOn(focusPersonId, 0.9);
    }
  }, [viewport.width, viewport.height, focusPersonId, layout.bounds, layout.personPositions, centreOn, fitToView]);

  // --- pointer interaction --------------------------------------------------
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const active = [...pointers.current.values()];

    if (active.length === 1) {
      setTransform((current) => ({
        ...current,
        x: current.x + (event.clientX - previous.x),
        y: current.y + (event.clientY - previous.y),
      }));
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
      const k = Math.max(MIN_SCALE, Math.min(pinchStart.current.k * ratio, MAX_SCALE));
      setTransform((current) => zoomAround(current, k, midX, midY, containerRef.current));
    }
  };

  const endPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!event.ctrlKey && Math.abs(event.deltaY) < 2) return;
    const factor = Math.exp(-event.deltaY * 0.0015);
    setTransform((current) => {
      const k = Math.max(MIN_SCALE, Math.min(current.k * factor, MAX_SCALE));
      return zoomAround(current, k, event.clientX, event.clientY, containerRef.current);
    });
  };

  // --- relationship highlighting -------------------------------------------
  const relationship = useMemo(() => {
    if (!focusPersonId || !selectedId || focusPersonId === selectedId) return null;
    const result = computeRelationship(index, focusPersonId, selectedId);
    if (result.descriptor.kind === 'unrelated') return { result, term: kinship.unknown };
    return { result, term: kinship.describe(result.descriptor) };
  }, [index, focusPersonId, selectedId, kinship]);

  const highlightedPeople = useMemo(() => {
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
      .slice(0, 8);
  }, [index, query]);

  const selectPerson = (personId: string) => {
    setSelectedId((current) => (current === personId ? null : personId));
  };

  const jumpToPerson = (personId: string) => {
    const person = index.people.get(personId);
    if (!person) return;
    const generation = person.generation ?? 1;
    // Move the window if the person is outside it, so search can always reach.
    if (generation < window_.from || generation > window_.to) {
      setWindow(generationWindow(generation, allGenerations.min, allGenerations.max, visibleGenerations));
    }
    setSelectedId(personId);
    setQuery('');
    requestAnimationFrame(() => centreOn(personId, Math.max(transform.k, 0.85)));
  };

  const selectedPerson = selectedId ? index.people.get(selectedId) : null;

  return (
    <div className="flex h-full flex-col">
      <TreeControls
        query={query}
        onQueryChange={setQuery}
        matches={matches.map((person) => ({
          id: person.id,
          label: displayName(person),
          detail: lifespan(person),
        }))}
        onPick={jumpToPerson}
        generations={layout.generations}
        window={window_}
        allGenerations={allGenerations}
        onWindowChange={(generation) =>
          setWindow(generationWindow(generation, allGenerations.min, allGenerations.max, visibleGenerations))
        }
        onFit={fitToView}
      />

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {layout.units.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            Энэ үеийн хүмүүс хараахан бүртгэгдээгүй байна.
          </p>
        ) : (
          <svg
            className="h-full w-full touch-none select-none"
            role="application"
            aria-label="Гэр бүлийн мод"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={endPointer}
            onWheel={onWheel}
          >
            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
              <TreeEdges layout={layout} highlighted={highlightedPeople} />
              {layout.units.map((unit) => (
                <TreeUnitNode
                  key={unit.id}
                  unit={unit}
                  index={index}
                  selectedId={selectedId}
                  focusPersonId={focusPersonId}
                  highlighted={highlightedPeople}
                  onSelect={selectPerson}
                  onOpen={onOpenPerson}
                  onOpenCouple={onOpenCouple}
                  photoUrls={photoUrls}
                />
              ))}
            </g>
          </svg>
        )}
      </div>

      {selectedPerson ? (
        <SelectionPanel
          name={displayName(selectedPerson)}
          years={lifespan(selectedPerson)}
          occupation={selectedPerson.occupation}
          relationshipLabel={relationship?.term.label ?? null}
          relationshipNote={relationship?.term.note ?? null}
          chain={
            relationship?.result.path.map((step, position) => ({
              id: step.personId,
              name: displayName(index.people.get(step.personId)),
              term: position === 0 ? kinship.self : kinship.describe(step.descriptor).label,
            })) ?? []
          }
          couples={(index.couplesByPerson.get(selectedPerson.id) ?? []).map((couple) => {
            const partnerId =
              couple.person_a_id === selectedPerson.id ? couple.person_b_id : couple.person_a_id;
            const partner = partnerId ? index.people.get(partnerId) : null;
            return { id: couple.id, label: partner ? displayName(partner) : 'Хос' };
          })}
          onOpen={() => onOpenPerson?.(selectedPerson.id)}
          onOpenCouple={(coupleId) => onOpenCouple?.(coupleId)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

/** Zoom about a screen point so the point under the fingers stays put. */
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

function unitCentreX(unit: TreeUnit): number {
  const spread = unit.partners.length * (NODE_WIDTH + PARTNER_GAP);
  return unit.x + NODE_WIDTH / 2 + spread / 2;
}

function TreeEdges({ layout, highlighted }: { layout: TreeLayout; highlighted: Set<string> }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Parent → children. One vertical drop, a horizontal bus, then a drop
          into each child: orthogonal routing reads as lineage, curves do not. */}
      {layout.units.map((unit) => {
        const children = unit.childUnitIds
          .map((id) => layout.unitsById.get(id))
          .filter((child): child is TreeUnit => child !== undefined && child.parentUnitId === unit.id);
        if (children.length === 0) return null;

        const startX = unitCentreX(unit);
        const startY = unit.y + NODE_HEIGHT;
        const busY = unit.y + NODE_HEIGHT + (ROW_HEIGHT - NODE_HEIGHT) / 2;

        return (
          <g key={`edges:${unit.id}`}>
            {children.map((child) => {
              const childX = child.x + NODE_WIDTH / 2;
              const active =
                highlighted.has(unit.anchorId) && highlighted.has(child.anchorId);
              return (
                <path
                  key={`${unit.id}->${child.id}`}
                  d={connector(startX, startY, childX, child.y, busY)}
                  stroke={active ? 'var(--color-forest)' : 'var(--color-sage-soft)'}
                  strokeWidth={active ? 2.2 : 1.3}
                  strokeLinecap="round"
                  opacity={active ? 1 : 0.75}
                />
              );
            })}
          </g>
        );
      })}

      {/* Marriages between two people who each anchor their own unit. */}
      {layout.crossLinks.map((link) => {
        const from = layout.unitsById.get(link.fromUnitId);
        const to = layout.unitsById.get(link.toUnitId);
        if (!from || !to) return null;
        const y = from.y + NODE_HEIGHT / 2;
        return (
          <path
            key={`cross:${link.coupleId}`}
            d={`M ${from.x + from.width} ${y} H ${to.x}`}
            stroke="var(--color-sage-soft)"
            strokeWidth={1.4}
            strokeDasharray="3 5"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

function TreeUnitNode({
  unit,
  index,
  selectedId,
  focusPersonId,
  highlighted,
  onSelect,
  onOpen,
  onOpenCouple,
  photoUrls,
}: {
  unit: TreeUnit;
  index: ReturnType<typeof buildFamilyIndex>;
  selectedId: string | null;
  focusPersonId: string | null;
  highlighted: Set<string>;
  onSelect: (personId: string) => void;
  onOpen?: (personId: string) => void;
  onOpenCouple?: (coupleId: string) => void;
  photoUrls: Record<string, string>;
}) {
  const members = [
    { personId: unit.anchorId, offset: 0 },
    ...unit.partners.map((partner, position) => ({
      personId: partner.personId,
      offset: (position + 1) * (NODE_WIDTH + PARTNER_GAP),
    })),
  ];

  return (
    <g transform={`translate(${unit.x} ${unit.y})`}>
      {/* The couple bond: a line and a heart, drawn between the two portraits. */}
      {unit.partners.map((partner, position) => {
        const x1 = NODE_WIDTH / 2 + position * (NODE_WIDTH + PARTNER_GAP);
        const x2 = x1 + NODE_WIDTH + PARTNER_GAP;
        const y = 28;
        return (
          <g
            key={`bond:${partner.coupleId}`}
            role="button"
            tabIndex={0}
            aria-label="Хосын хуудас нээх"
            className="cursor-pointer outline-none"
            onClick={() => onOpenCouple?.(partner.coupleId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenCouple?.(partner.coupleId);
              }
            }}
          >
            {/* An invisible target: the heart is 11px of glyph, which is not a
                tap target on a phone. */}
            <rect
              x={x1 + 24}
              y={y - 16}
              width={x2 - x1 - 48}
              height={32}
              fill="transparent"
            />
            <line
              x1={x1 + 30}
              y1={y}
              x2={x2 - 30}
              y2={y}
              stroke="var(--color-sage-soft)"
              strokeWidth={1.3}
            />
            <text
              x={(x1 + x2) / 2}
              y={y + 4}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-heart)"
            >
              ♥
            </text>
          </g>
        );
      })}

      {members.map(({ personId, offset }) => {
        const person = index.people.get(personId);
        if (!person) return null;
        const isSelected = selectedId === personId;
        const isFocus = focusPersonId === personId;
        const isOnPath = highlighted.has(personId);
        const years = lifespan(person);
        const photoUrl = photoUrls[personId];

        return (
          <g
            key={personId}
            transform={`translate(${offset} 0)`}
            role="button"
            tabIndex={0}
            aria-label={`${displayName(person)}${years ? `, ${years}` : ''}`}
            className="cursor-pointer outline-none"
            onClick={() => onSelect(personId)}
            onDoubleClick={() => onOpen?.(personId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(personId);
              }
            }}
          >
            {/* A face, drawn as a circle. No card: a tree of boxes is an org
                chart, and the whole point of this screen is that these are
                people. Selection is a ring, which needs no extra chrome. */}
            <circle
              cx={NODE_WIDTH / 2}
              cy={PORTRAIT_CY}
              r={PORTRAIT_R + 3}
              fill="none"
              stroke={
                isSelected ? 'var(--color-forest)'
                  : isFocus ? 'var(--color-sage)'
                  : isOnPath ? 'var(--color-forest-soft)'
                  : 'transparent'
              }
              strokeWidth={isSelected || isFocus ? 2 : 1.6}
            />
            <circle
              cx={NODE_WIDTH / 2}
              cy={PORTRAIT_CY}
              r={PORTRAIT_R}
              fill="var(--color-sage-wash)"
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            {photoUrl ? (
              <>
                <clipPath id={`portrait-${personId}`}>
                  <circle cx={NODE_WIDTH / 2} cy={PORTRAIT_CY} r={PORTRAIT_R} />
                </clipPath>
                <image
                  href={photoUrl}
                  x={NODE_WIDTH / 2 - PORTRAIT_R}
                  y={PORTRAIT_CY - PORTRAIT_R}
                  width={PORTRAIT_R * 2}
                  height={PORTRAIT_R * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#portrait-${personId})`}
                />
              </>
            ) : (
              <text
                x={NODE_WIDTH / 2}
                y={PORTRAIT_CY + 7}
                textAnchor="middle"
                fontSize={20}
                fontFamily="var(--font-display)"
                fill="var(--color-sage)"
              >
                {displayName(person).slice(0, 1)}
              </text>
            )}

            <text
              x={NODE_WIDTH / 2}
              y={PORTRAIT_CY + PORTRAIT_R + 18}
              textAnchor="middle"
              fontSize={11.5}
              fontFamily="var(--font-display)"
              fill="var(--color-ink)"
            >
              {truncate(displayName(person), 11)}
            </text>
            {years ? (
              <text
                x={NODE_WIDTH / 2}
                y={PORTRAIT_CY + PORTRAIT_R + 31}
                textAnchor="middle"
                fontSize={9.5}
                fill="var(--color-muted)"
              >
                {years}
              </text>
            ) : null}
            {person.life_status === 'deceased' ? (
              <circle
                cx={NODE_WIDTH / 2 + PORTRAIT_R - 4}
                cy={PORTRAIT_CY - PORTRAIT_R + 6}
                r={3}
                fill="var(--color-muted)"
                opacity={0.55}
              />
            ) : null}
            {isFocus ? (
              <text
                x={NODE_WIDTH / 2}
                y={PORTRAIT_CY + PORTRAIT_R + 44}
                textAnchor="middle"
                fontSize={9}
                fill="var(--color-sage)"
              >
                Та
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Portrait geometry, shared by the node and the couple bond. */
const PORTRAIT_R = 26;
const PORTRAIT_CY = 28;

/**
 * A parent→child connector with rounded corners.
 *
 * Straight elbows read as a circuit diagram. The radius is clamped to the
 * space actually available so a child directly below its parent still gets a
 * clean vertical line rather than a kink.
 */
function connector(startX: number, startY: number, endX: number, endY: number, busY: number): string {
  const dx = endX - startX;
  if (Math.abs(dx) < 1) return `M ${startX} ${startY} V ${endY}`;

  const direction = Math.sign(dx);
  const radius = Math.min(14, Math.abs(dx) / 2, (busY - startY) / 2, (endY - busY) / 2);

  return [
    `M ${startX} ${startY}`,
    `V ${busY - radius}`,
    `Q ${startX} ${busY} ${startX + direction * radius} ${busY}`,
    `H ${endX - direction * radius}`,
    `Q ${endX} ${busY} ${endX} ${busY + radius}`,
    `V ${endY}`,
  ].join(' ');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function TreeControls({
  query,
  onQueryChange,
  matches,
  onPick,
  generations,
  window: activeWindow,
  allGenerations,
  onWindowChange,
  onFit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  matches: Array<{ id: string; label: string; detail: string }>;
  onPick: (personId: string) => void;
  generations: number[];
  window: { from: number; to: number; archivedAbove: number; archivedBelow: number };
  allGenerations: { min: number; max: number };
  onWindowChange: (generation: number) => void;
  onFit: () => void;
}) {
  return (
    <div className="px-5 pb-3">
      <div className="relative flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Хүн хайх"
          aria-label="Гэр бүлийн модноос хайх"
          className="min-h-11 flex-1 rounded-pill border border-transparent bg-parchment-deep/70 px-4 text-[16px] text-ink placeholder:text-muted focus:border-sage-soft focus:bg-surface focus:outline-none"
        />
        <button
          type="button"
          onClick={onFit}
          className="min-h-11 shrink-0 rounded-pill px-3 text-sm text-sage"
        >
          Бүгд
        </button>

        {matches.length > 0 ? (
          <ul className="absolute inset-x-0 top-12 z-20 max-h-64 overflow-auto rounded-2xl border border-line bg-surface p-1 shadow-(--shadow-lift)">
            {matches.map((match) => (
              <li key={match.id}>
                <button
                  type="button"
                  onClick={() => onPick(match.id)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-parchment-deep"
                >
                  <span className="text-sm font-medium text-ink">{match.label}</span>
                  <span className="text-xs text-muted">{match.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {activeWindow.archivedAbove > 0 ? (
          <button
            type="button"
            onClick={() => onWindowChange(Math.max(allGenerations.min, activeWindow.from - 3))}
            className="shrink-0 rounded-pill bg-olive-wash px-3 py-1.5 text-xs font-medium text-olive"
          >
            ↑ Архивт {activeWindow.archivedAbove} үе
          </button>
        ) : null}

        {generations.map((generation) => (
          <button
            key={generation}
            type="button"
            onClick={() => onWindowChange(generation)}
            className={cn(
              'shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
              generation >= activeWindow.from && generation <= activeWindow.to
                ? 'bg-forest-wash text-forest'
                : 'text-muted hover:text-ink-soft',
            )}
          >
            {generation}-р үе
          </button>
        ))}

        {activeWindow.archivedBelow > 0 ? (
          <button
            type="button"
            onClick={() => onWindowChange(Math.min(allGenerations.max, activeWindow.to + 3))}
            className="shrink-0 rounded-pill bg-olive-wash px-3 py-1.5 text-xs font-medium text-olive"
          >
            ↓ Дараагийн {activeWindow.archivedBelow} үе
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SelectionPanel({
  name,
  years,
  occupation,
  relationshipLabel,
  relationshipNote,
  chain,
  couples,
  onOpen,
  onOpenCouple,
  onClose,
}: {
  name: string;
  years: string;
  occupation: string | null;
  relationshipLabel: string | null;
  relationshipNote: string | null;
  chain: Array<{ id: string; name: string; term: string }>;
  /** This person's marriages, so the couple page is one tap from the tree. */
  couples: Array<{ id: string; label: string }>;
  onOpen: () => void;
  onOpenCouple?: (coupleId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fade-up border-t border-line bg-surface px-4 py-3 shadow-(--shadow-lift)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight text-ink">{name}</p>
          <p className="text-sm text-muted">
            {[years, occupation].filter(Boolean).join(' · ') || 'Мэдээлэл нэмэгдээгүй'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="-mr-1 -mt-1 h-9 w-9 rounded-full text-muted"
        >
          ✕
        </button>
      </div>

      {relationshipLabel ? (
        <div className="mt-3 rounded-2xl bg-forest-wash px-3 py-2.5">
          <p className="text-sm font-medium text-forest">Таны {relationshipLabel.toLocaleLowerCase('mn-MN')}</p>
          {chain.length > 1 ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {chain.map((step) => `${step.term} (${step.name})`).join(' → ')}
            </p>
          ) : null}
          {relationshipNote ? <p className="mt-1 text-xs text-muted">{relationshipNote}</p> : null}
        </div>
      ) : null}

      {couples.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {couples.map((couple) => (
            <li key={couple.id}>
              <button
                type="button"
                onClick={() => onOpenCouple?.(couple.id)}
                className="min-h-10 rounded-pill bg-parchment-deep px-4 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                <span className="text-heart">♥</span> {couple.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 min-h-12 w-full rounded-full bg-forest text-sm font-medium text-forest-ink"
      >
        Профайл нээх
      </button>
    </div>
  );
}
