import React, { useState, useMemo } from 'react';

const IndiaMap = ({ cityStatus = [], lockdownLinks = [], selectedLinks = [] }) => {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Base SVG dimensions for the viewBox
  const width = 800;
  const height = 800;
  const padding = 60;

  // Compute projection bounds based on given latitude and longitude
  const bounds = useMemo(() => {
    if (!cityStatus || cityStatus.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    cityStatus.forEach(node => {
      if (node.lat < minLat) minLat = node.lat;
      if (node.lat > maxLat) maxLat = node.lat;
      if (node.lng < minLng) minLng = node.lng;
      if (node.lng > maxLng) maxLng = node.lng;
    });

    // Provide a small fallback buffer to avoid division by zero if all coords are the same
    if (minLat === maxLat) { minLat -= 1; maxLat += 1; }
    if (minLng === maxLng) { minLng -= 1; maxLng += 1; }

    return { minLat, maxLat, minLng, maxLng };
  }, [cityStatus]);

  // Determine max projected_I_p50 for relative node sizing
  const maxInfections = useMemo(() => {
    if (!cityStatus || cityStatus.length === 0) return 1;
    return Math.max(...cityStatus.map(n => n.projected_I_p50 || 0), 1);
  }, [cityStatus]);

  // Simple min-max projection mapping lat/lng to SVG x/y coordinates
  const project = (lat, lng) => {
    if (!bounds) return { x: width / 2, y: height / 2 };
    const { minLat, maxLat, minLng, maxLng } = bounds;
    
    // x maps to longitude (West to East)
    const x = padding + ((lng - minLng) / (maxLng - minLng)) * (width - 2 * padding);
    // y maps to latitude (North to South is inverted in SVG coordinates)
    const y = height - padding - ((lat - minLat) / (maxLat - minLat)) * (height - 2 * padding);
    
    return { x, y };
  };

  const getNodeColor = (node) => {
    if (node.overwhelmed) return '#ef4444'; // Red if overwhelmed
    
    // Check if approaching capacity
    const capacityRatio = node.projected_I_p50 / (node.bed_capacity || 1);
    if (capacityRatio > 0.15) return '#f59e0b'; // Amber if >15% capacity
    
    return '#10b981'; // Green otherwise
  };

  const getNodeRadius = (node) => {
    const minRadius = 6;
    const maxRadius = 32;
    const ratio = node.projected_I_p50 / maxInfections;
    return minRadius + (ratio * (maxRadius - minRadius));
  };

  return (
    <div className="relative w-full bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-sans p-6">
      <div className="mb-4 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">Transmission Network</h2>
        <p className="text-slate-400 text-sm mt-1">Inter-city transmission routes and lockdown targets</p>
      </div>

      <div className="relative w-full flex justify-center items-center">
        <svg 
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-2xl h-auto"
        >
          {/* Edges Layer */}
          <g id="edges">
            {lockdownLinks.map(link => {
              // Try finding node by ID first, then by exact string name
              const sourceNode = cityStatus.find(n => n.node_id === link.source_city || n.city_name === link.source_city);
              const destNode = cityStatus.find(n => n.node_id === link.dest_city || n.city_name === link.dest_city);
              
              if (!sourceNode || !destNode) return null;

              const { x: x1, y: y1 } = project(sourceNode.lat, sourceNode.lng);
              const { x: x2, y: y2 } = project(destNode.lat, destNode.lng);
              
              const isCut = selectedLinks.includes(link.link_id);
              
              // Highlight active recommendations in orange, cut edges in dim slate
              const strokeColor = isCut ? '#334155' : '#f97316';
              const strokeWidth = isCut ? 1.5 : 2.5;
              const strokeDasharray = isCut ? "4 4" : (link.mode === 'air' ? "6 6" : "none");
              const strokeOpacity = isCut ? 0.4 : 0.8;

              return (
                <line
                  key={link.link_id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeOpacity={strokeOpacity}
                  className="transition-all duration-300"
                />
              );
            })}
          </g>

          {/* Nodes Layer */}
          <g id="nodes">
            {cityStatus.map(node => {
              const { x, y } = project(node.lat, node.lng);
              const r = getNodeRadius(node);
              const color = getNodeColor(node);
              const isHovered = hoveredNode?.node_id === node.node_id;

              return (
                <g 
                  key={node.node_id}
                  onMouseEnter={(e) => {
                    setHoveredNode(node);
                    // Approximate screen position using standard event client coords
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer transition-transform duration-200"
                  style={{ transformOrigin: `${x}px ${y}px`, transform: isHovered ? 'scale(1.15)' : 'scale(1)' }}
                >
                  {/* Pulsing Glow for overwhelmed nodes */}
                  {node.overwhelmed && (
                    <circle cx={x} cy={y} r={r * 1.6} fill={color} opacity="0.25" className="animate-pulse pointer-events-none" />
                  )}
                  
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={color}
                    stroke="#020617"
                    strokeWidth="2.5"
                  />
                  
                  {/* Node City Label */}
                  <text
                    x={x}
                    y={y + r + 14}
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="12"
                    fontWeight="500"
                    className="pointer-events-none"
                  >
                    {node.city_name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Tooltip */}
        {hoveredNode && (
          <div 
            className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-4 pointer-events-none transform -translate-x-1/2 -translate-y-[110%] w-64"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold text-base">{hoveredNode.city_name}</h3>
              <span className="text-slate-500 text-xs font-mono bg-slate-800 px-1.5 py-0.5 rounded">{hoveredNode.node_id}</span>
            </div>
            
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Status:</span>
                <span className={`font-bold ${hoveredNode.overwhelmed ? 'text-red-400' : (hoveredNode.projected_I_p50 / (hoveredNode.bed_capacity || 1) > 0.15 ? 'text-amber-400' : 'text-emerald-400')}`}>
                  {hoveredNode.overwhelmed ? 'OVERWHELMED' : 'SAFE'}
                </span>
              </div>
              
              <div className="flex justify-between text-slate-300">
                <span>Peak Day:</span>
                <span className="font-medium text-white">Day {hoveredNode.peak_day}</span>
              </div>
              
              <div className="flex justify-between text-slate-300">
                <span>Peak Infections:</span>
                <span className="font-medium text-white">{Math.round(hoveredNode.projected_I_p50).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between text-slate-300">
                <span>Total Beds:</span>
                <span className="font-medium text-white">{Math.round(hoveredNode.bed_capacity).toLocaleString()}</span>
              </div>
              
              <div className="mt-3 pt-2 border-t border-slate-800">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Capacity Saturation</span>
                  <span>{Math.round((hoveredNode.projected_I_p50 / (hoveredNode.bed_capacity || 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${hoveredNode.overwhelmed ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (hoveredNode.projected_I_p50 / (hoveredNode.bed_capacity || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Legend */}
      <div className="flex flex-wrap items-center gap-5 mt-4 text-xs text-slate-400 border-t border-slate-800 pt-5">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-slate-900" /> Safe Node
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-slate-900" /> &gt;15% Bed Saturation
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse border border-slate-900" /> Overwhelmed Node
        </div>
        
        <div className="w-px h-4 bg-slate-700 mx-1" />
        
        <div className="flex items-center gap-2">
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#f97316" strokeWidth="2.5" /></svg> Rail Link
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#f97316" strokeWidth="2.5" strokeDasharray="5 5" /></svg> Air Link
        </div>
        <div className="flex items-center gap-2 opacity-60">
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" /></svg> Cut Link
        </div>
      </div>
    </div>
  );
};

export default IndiaMap;
