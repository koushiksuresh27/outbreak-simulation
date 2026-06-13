import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const ScenarioComparator = ({ scenarios = [], onSelectScenario }) => {
  const [expandedCard, setExpandedCard] = useState(null);

  if (!scenarios || scenarios.length === 0) return null;

  // Find baseline (assume "No Lockdown" is the baseline, or default to the first element)
  const baseline = scenarios.find(s => s.name.toLowerCase().includes('no lockdown')) || scenarios[0];

  const getDiff = (current, base, isHigherBetter = false) => {
    if (current === base) return null;
    const diff = current - base;
    const isImprovement = isHigherBetter ? diff > 0 : diff < 0;
    const percentage = Math.abs((diff / base) * 100).toFixed(1);
    
    return {
      value: diff,
      percentage: percentage,
      isImprovement
    };
  };

  // Prepare data for the BarChart
  const chartData = scenarios.map(s => ({
    name: s.name.split(' (')[0], // Extract just "Partial", "Full", etc. for x-axis
    fullName: s.name,
    peakInfections: s.peak_I_p50,
  }));

  const toggleExpand = (idx) => {
    setExpandedCard(expandedCard === idx ? null : idx);
  };

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl w-full font-sans text-slate-200">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Intervention Strategies</h2>
          <p className="text-slate-400 text-sm mt-1">Compare predictive outcomes of targeted edge lockdowns</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="w-full h-64 mb-8 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
        <h3 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider text-center">Peak Infections Comparison</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
            <YAxis 
              stroke="#64748b" 
              tick={{ fill: '#94a3b8', fontSize: 13 }}
              tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(val)}
              axisLine={false} tickLine={false}
            />
            <RechartsTooltip 
              cursor={{ fill: '#1e293b', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }}
              itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
              formatter={(value) => [new Intl.NumberFormat('en-US').format(value), 'Peak Infections']}
            />
            <Bar dataKey="peakInfections" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : (index === 1 ? '#f59e0b' : '#10b981')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scenarios.map((scenario, idx) => {
          const diffPeak = getDiff(scenario.peak_I_p50, baseline.peak_I_p50);
          const diffDeaths = getDiff(scenario.total_deaths_p50, baseline.total_deaths_p50);
          const diffCities = getDiff(scenario.overwhelmed_cities, baseline.overwhelmed_cities);
          // For days_to_peak, delaying the peak (positive diff) is generally an improvement (flattens the curve)
          const diffDays = getDiff(scenario.days_to_peak, baseline.days_to_peak, true); 

          const isBaseline = scenario.name === baseline.name;
          const isExpanded = expandedCard === idx;

          return (
            <div key={idx} className={`flex flex-col bg-slate-900 border ${isBaseline ? 'border-slate-700 bg-slate-800/30' : 'border-slate-800'} rounded-xl overflow-hidden transition-all duration-300 hover:border-slate-600`}>
              <div className="p-5 flex-grow">
                <h3 className="text-lg font-bold text-white mb-5 line-clamp-2">{scenario.name}</h3>
                
                <div className="space-y-4">
                  {/* Metric: Peak Infections */}
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Peak Infections (P50)</p>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-semibold text-slate-100">
                        {new Intl.NumberFormat('en-US').format(scenario.peak_I_p50)}
                      </span>
                      {!isBaseline && diffPeak && (
                        <span className={`text-sm font-medium mb-1 flex items-center ${diffPeak.isImprovement ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diffPeak.isImprovement ? '↓' : '↑'} {diffPeak.percentage}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metric: Total Deaths */}
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Deaths</p>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-medium text-slate-200">
                        {new Intl.NumberFormat('en-US').format(scenario.total_deaths_p50)}
                      </span>
                      {!isBaseline && diffDeaths && (
                        <span className={`text-sm font-medium mb-0.5 flex items-center ${diffDeaths.isImprovement ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diffDeaths.isImprovement ? '↓' : '↑'} {diffDeaths.percentage}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metric: Overwhelmed Cities */}
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overwhelmed Hubs</p>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-medium text-slate-200">
                        {scenario.overwhelmed_cities}
                      </span>
                      {!isBaseline && diffCities && (
                        <span className={`text-sm font-medium mb-0.5 flex items-center ${diffCities.isImprovement ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diffCities.isImprovement ? '↓' : '↑'} {Math.abs(diffCities.value)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metric: Days to Peak */}
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Days to Peak</p>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-medium text-slate-200">
                        Day {scenario.days_to_peak}
                      </span>
                      {!isBaseline && diffDays && (
                        <span className={`text-sm font-medium mb-0.5 flex items-center ${diffDays.isImprovement ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {diffDays.isImprovement ? 'Delayed by' : 'Earlier by'} {Math.abs(diffDays.value)}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Link Cuts Section */}
                {scenario.top_links_cut && scenario.top_links_cut.length > 0 && (
                  <div className="mt-6 border-t border-slate-800 pt-4">
                    <button 
                      onClick={() => toggleExpand(idx)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? 'Hide' : 'View'} Link Cuts ({scenario.top_links_cut.length})
                      <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isExpanded && (
                      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {scenario.top_links_cut.map((link, lIdx) => (
                          <div key={lIdx} className="bg-slate-950 p-2.5 rounded text-xs border border-slate-800/80 hover:border-slate-700 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-300">
                                {link.source_city} → {link.dest_city}
                              </span>
                              <span className="text-slate-500 uppercase font-mono text-[10px] tracking-wider px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800">
                                {link.mode}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Est. Spread Reduction:</span>
                              <span className="text-emerald-400 font-medium">-{link.projected_spread_reduction_pct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Action Button */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 mt-auto">
                <button
                  onClick={() => onSelectScenario && onSelectScenario(scenario.name)}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 
                    ${isBaseline 
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                      : 'bg-cyan-900/40 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-800/60 hover:text-cyan-100 shadow-[0_0_15px_rgba(8,145,178,0.15)] hover:shadow-[0_0_20px_rgba(8,145,178,0.3)]'
                    }`}
                >
                  {isBaseline ? 'Select Baseline' : 'Activate Intervention'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
};

export default ScenarioComparator;
