import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls, Text } from '@react-three/drei';
import { motion, useReducedMotion } from 'motion/react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ClusterNode, NodeEdge } from '../types/telemetry';

import { EmptyState } from '../components/EmptyState';
import { uiLabels } from '../uiLabels';

interface DeviceTopology3DProps {
  nodes: ClusterNode[];
  edges: NodeEdge[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  compact?: boolean;
}

const _targetScale = new THREE.Vector3();

const PLATFORM_COLORS: Record<ClusterNode['platform'], string> = {
  windows: '#2878A8',
  macos: '#91E3D2',
  cloud: '#6ED6C1',
  android: '#2E9B72',
  ios: '#F6C86E',
};

function getStatusColor(status: ClusterNode['status']): string {
  if (status === 'Sağlıklı' || status === 'Nöbet Aktif') return '#2E9B72';
  if (status === 'Uyarı') return '#D9822B';
  return '#C94A4A';
}

function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererName = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
  } catch {
    return true;
  }
}

function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(envScene, 0.04);
    scene.environment = envTarget.texture;
    return () => {
      scene.environment = null;
      envTarget.dispose();
      envScene.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

interface DeviceNodeMeshProps {
  node: ClusterNode;
  position: [number, number, number];
  isSelected: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}

function DeviceNodeMesh({
  node,
  position,
  isSelected,
  reducedMotion,
  onSelect,
}: DeviceNodeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const chassisColor = PLATFORM_COLORS[node.platform];
  const statusColor = getStatusColor(node.status);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const s = isSelected ? 1.14 : hovered ? 1.07 : 1;
    _targetScale.set(s, s, s);
    groupRef.current.scale.lerp(_targetScale, Math.min(1, delta * 10));

    if (!reducedMotion && node.platform === 'cloud') {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  const isDesktop = node.platform === 'windows' || node.platform === 'macos';
  const isCloud = node.platform === 'cloud';

  return (
    <group position={position}>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[0.72, 0.82, 0.12, 32]} />
          <meshStandardMaterial color="#102A43" roughness={0.75} metalness={0.25} />
        </mesh>

        {isCloud ? (
          <mesh position={[0, 0.68, 0]} castShadow>
            <octahedronGeometry args={[0.52, 0]} />
            <meshStandardMaterial color={chassisColor} roughness={0.22} metalness={0.78} />
          </mesh>
        ) : isDesktop ? (
          <mesh position={[0, 0.54, 0]} castShadow>
            <boxGeometry args={[0.92, 0.64, 0.56]} />
            <meshStandardMaterial color={chassisColor} roughness={0.28} metalness={0.68} />
          </mesh>
        ) : (
          <mesh position={[0, 0.56, 0]} castShadow>
            <boxGeometry args={[0.48, 0.82, 0.14]} />
            <meshStandardMaterial color={chassisColor} roughness={0.24} metalness={0.72} />
          </mesh>
        )}

        <mesh position={[0, isCloud ? 0.14 : 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[isCloud ? 0.68 : 0.34, 0.04, 12, 32]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={isSelected ? 0.9 : 0.45}
            roughness={0.18}
            metalness={0.3}
          />
        </mesh>
      </group>

      <Text
        position={[0, -0.28, 0.62]}
        rotation={[-Math.PI / 4, 0, 0]}
        fontSize={0.21}
        color={isSelected ? '#FFFFFF' : '#91E3D2'}
        anchorX="center"
        anchorY="middle"
      >
        {node.hostname}
      </Text>
    </group>
  );
}

export const DeviceTopology3D: React.FC<DeviceTopology3DProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  compact = false,
}) => {
  const reducedMotion = Boolean(useReducedMotion());
  const isSoftwareGl = useMemo(() => detectSoftwareGl(), []);
  const [contextLost, setContextLost] = useState(false);

  const nodePositions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    const cloudNode = nodes.find((n) => n.platform === 'cloud');
    const edgeNodes = nodes.filter((n) => n.platform !== 'cloud');

    if (cloudNode) {
      map.set(cloudNode.id, [0, 0, 0]);
    }

    const radius = 3.1;
    edgeNodes.forEach((node, index) => {
      const angle = (index / Math.max(edgeNodes.length, 1)) * Math.PI * 2 - Math.PI / 4;
      map.set(node.id, [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
    });

    return map;
  }, [nodes]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0] ?? null;

  if (nodes.length === 0) {
    return (
      <EmptyState
        title={uiLabels.noPairedDevices}
        description="Henüz bu merkeze bağlanmış bir cihaz bulunmuyor."
      />
    );
  }

  if (contextLost) {
    return (
      <div
        className={`${compact ? 'h-[260px]' : 'h-[380px]'} flex flex-col items-center justify-center text-center rounded-xl border border-[#D9E2EC] bg-[#F5F8FA] px-4`}
      >
        <p className="text-sm font-medium text-[#D9822B]">WebGL bağlamı askıya alındı</p>
        <p className="text-xs text-[#627D98] mt-1">
          2D Şema görünümüne geçerek cihaz ağını inceleyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[#163B5C] bg-[#071A2B] ${
        compact ? 'h-[270px]' : 'h-[380px] lg:h-[420px]'
      }`}
    >
      <Canvas
        shadows={!isSoftwareGl}
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{ position: [0, 4.6, 7.2], fov: 42 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        onCreated={({ gl }) => {
          const dom = gl.domElement;
          dom.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          dom.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
          });
        }}
      >
        <color attach="background" args={['#071A2B']} />
        <fog attach="fog" args={['#071A2B', 11, 22]} />

        <StudioEnvironment />

        <hemisphereLight args={['#91E3D2', '#071A2B', 0.48]} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.35}
          color="#FFF7ED"
          castShadow={!isSoftwareGl}
        />
        <pointLight position={[-5, 3, -4]} intensity={0.65} color="#6ED6C1" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[6.4, 48]} />
          <meshStandardMaterial color="#0A2136" roughness={0.9} metalness={0.1} />
        </mesh>
        <gridHelper args={[12, 16, '#163B5C', '#102A43']} position={[0, 0, 0]} />

        {edges.map((edge) => {
          const start = nodePositions.get(edge.source);
          const end = nodePositions.get(edge.target);
          if (!start || !end) return null;
          const isFocused = edge.source === selectedNodeId || edge.target === selectedNodeId;
          return (
            <Line
              key={edge.id}
              points={[
                [start[0], 0.35, start[2]],
                [end[0], 0.35, end[2]],
              ]}
              color={isFocused ? '#6ED6C1' : '#2878A8'}
              lineWidth={isFocused ? 2.2 : 1.2}
            />
          );
        })}

        {nodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          return (
            <DeviceNodeMesh
              key={node.id}
              node={node}
              position={pos}
              isSelected={node.id === selectedNodeId}
              reducedMotion={reducedMotion}
              onSelect={() => onSelectNode(node.id)}
            />
          );
        })}

        <OrbitControls
          enablePan={false}
          enableDamping={!isSoftwareGl}
          dampingFactor={0.07}
          minDistance={4.5}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.15}
        />
      </Canvas>

      {selectedNode && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
          <div className="pointer-events-auto rounded-lg border border-white/15 bg-[#071A2B]/95 px-3 py-1.5 text-xs flex items-center gap-2.5">
            <span className="font-mono font-semibold text-white">{selectedNode.hostname}</span>
            <span className="text-white/40" aria-hidden="true">·</span>
            <span
              className="font-mono text-[11px]"
              style={{ color: getStatusColor(selectedNode.status) }}
            >
              {selectedNode.status}
            </span>
          </div>
          <span className="rounded-lg border border-white/15 bg-[#071A2B]/95 px-2.5 py-1.5 font-mono text-[10.5px] text-white/75">
            Döndürmek için sürükle · Seçmek için cihaza tıkla
          </span>
        </div>
      )}
    </div>
  );
};

export function TopologyStatusBadge({ status }: { status: ClusterNode['status'] }) {
  const color = getStatusColor(status);
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      className="font-mono text-xs font-medium"
      style={{ color }}
    >
      {status}
    </motion.span>
  );
}
