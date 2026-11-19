import React, { useState } from 'react';
import { ClusterNode, NodeEdge, NodeRole } from '../types/telemetry';

interface TopologyCanvasProps {
  nodes: ClusterNode[];
  edges: NodeEdge[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  roleFilter?: NodeRole | 'All';
  animateFlow?: boolean;
  compact?: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  roleFilter = 'All',
  animateFlow = true,
  compact = false,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const visibleNodeIds = new Set(
    nodes.filter((n) => roleFilter === 'All' || n.role === roleFilter).map((n) => n.id)
  );

  const nodeMap = new Map<string, ClusterNode>(nodes.map((n) => [n.id, n]));
  const focusId = hoveredNodeId || selectedNodeId;

  const getStatusStroke = (status: ClusterNode['status']) => {
    if (status === 'Sağlıklı' || status === 'Nöbet Aktif') return '#2E9B72';
    if (status === 'Uyarı') return '#D9822B';
    return '#C94A4A';
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#D9E2EC] bg-[#F5F8FA]">
      <svg
        viewBox="0 0 920 370"
        className={`w-full ${compact ? 'h-[260px]' : 'h-[350px] lg:h-[400px]'} select-none`}
        role="img"
        aria-label="Cihaz ağı ve E2E bağlantıları"
      >
        <defs>
          <pattern id="topo-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="rgba(16, 42, 67, 0.06)"
              strokeWidth="0.75"
            />
          </pattern>
        </defs>

        <rect width="920" height="370" fill="url(#topo-grid)" />

        <g className="fill-[#627D98] font-mono text-[10px]">
          <text x="170" y="34" textAnchor="middle">MASAÜSTÜ AJANLARI (DERİN)</text>
          <text x="460" y="34" textAnchor="middle">BULUT KORELASYON & E2E</text>
          <text x="750" y="34" textAnchor="middle">MOBİL NÖBET & ONAY</text>
        </g>

        {edges.map((edge) => {
          const src = nodeMap.get(edge.source);
          const dst = nodeMap.get(edge.target);
          if (!src || !dst) return null;

          const bothVisible = visibleNodeIds.has(src.id) && visibleNodeIds.has(dst.id);
          const isConnectedToFocus = focusId === src.id || focusId === dst.id;
          const isLocked = src.status === 'Kilitli' || dst.status === 'Kilitli';

          const strokeColor = isLocked
            ? 'rgba(201, 74, 74, 0.45)'
            : isConnectedToFocus
              ? '#2878A8'
              : 'rgba(98, 125, 152, 0.45)';

          const midX = (src.x + dst.x) / 2;
          const midY = (src.y + dst.y) / 2;

          return (
            <g key={edge.id} opacity={bothVisible ? 1 : 0.18}>
              <line
                x1={src.x}
                y1={src.y}
                x2={dst.x}
                y2={dst.y}
                stroke={strokeColor}
                strokeWidth={isConnectedToFocus ? 2.2 : 1.4}
                strokeDasharray={animateFlow && !isLocked ? '6 6' : undefined}
                className={animateFlow && !isLocked ? 'animate-packet-flow' : undefined}
              />
              {isConnectedToFocus && !compact && (
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-46"
                    y="-10"
                    width="92"
                    height="20"
                    rx="4"
                    fill="#FFFFFF"
                    stroke="#D9E2EC"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    className="fill-[#102A43] font-mono text-[9px]"
                  >
                    {edge.protocol} · {edge.latencyMs.toFixed(1)}ms
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {nodes.map((node) => {
          const isVisible = visibleNodeIds.has(node.id);
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const accent = getStatusStroke(node.status);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              opacity={isVisible ? 1 : 0.25}
              onClick={() => onSelectNode(node.id)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${node.hostname} cihazını seç (${node.status})`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectNode(node.id);
                }
              }}
            >
              {isSelected && (
                <rect
                  x="-90"
                  y="-33"
                  width="180"
                  height="66"
                  rx="12"
                  fill="none"
                  stroke="#2878A8"
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                />
              )}

              <rect
                x="-84"
                y="-27"
                width="168"
                height="54"
                rx="9"
                fill={isSelected || isHovered ? '#102A43' : '#FFFFFF'}
                stroke={isSelected ? '#2878A8' : isHovered ? '#102A43' : '#D9E2EC'}
                strokeWidth="1"
              />

              <line
                x1="-70"
                y1="-26"
                x2="70"
                y2="-26"
                stroke={accent}
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              <text
                x="-68"
                y="-5"
                className={`font-mono text-[11px] font-medium ${
                  isSelected || isHovered ? 'fill-white' : 'fill-[#102A43]'
                }`}
              >
                {node.hostname}
              </text>
              <text
                x="-68"
                y="14"
                className={`font-mono text-[9.5px] ${
                  isSelected || isHovered ? 'fill-[#91E3D2]' : 'fill-[#627D98]'
                }`}
              >
                {node.status} · {node.osVersion.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
