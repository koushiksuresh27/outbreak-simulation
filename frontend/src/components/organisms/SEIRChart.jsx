import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, ReferenceLine
} from 'recharts';

const SEIRChart = ({ data, selectedCity: initialCity, selectedScenario: initialScenario }) => {
  const [selectedCity, setSelectedCity] = useState(initialCity || '');
  const [selectedScenario, setSelectedScenario] = useState(initialScenario || 'no_lockdown');

  // Extract unique cities for the toggle dropdown
  const cities = useMemo(() => {
    if (!data?.seird_results) return [];
    return [...new Set(data.seird_results.map(d => d.city))];
  }, [data]);

  // Set initial city if empty
  if (!selectedCity && cities.length > 0) {
    setSelectedCity(cities[0]);
  }

  const scenarios = ['no_lockdown', 'partial', 'full'];

  // Process data for Recharts
  const chartData = useMemo(() => {
    if (!data?.seird_results || !data?.confidence_bands) return [];

    const results = data.seird_results.filter(
      d => d.city === selectedCity && d.scenario === selectedScenario
    );
    const bands = data.confidence_bands.filter(
      d => d.city === selectedCity
    );

    // Merge by day
    return results.map(r => {
      const band = bands.find(b => b.day === r.day);
      return {
        day: r.day,
        S: r.S,
        E: r.E,
        I: r.I,
        R: r.R,
        D: r.D,
        // Array format [min, max] works in Recharts Area for shaded ranges
        confidenceRange: band ? [band.p10, band.p90] : null
      };
    }).sort((a, b) => a.day - b.day);
  }, [data, selectedCity, selectedScenario]);

  // Find peak infection day for the vertical reference line
  const peakDay = useMemo(() => {
    if (!chartData.length) return 0;
    let maxI = -1;
    let peakDay = 0;
    chartData.forEach(d => {
      if (d.I > maxI) {
        maxI = d.I;
        peakDay = d.day;
      }
    });
    return peakDay;
  }, [chartData]);

  // Color coding matching the instructions
  const colors = {
    S: '#3b82f6', // blue
    E: '#f59e0b', // amber
    I: '#ef4444', // red
    R: '#10b981', // green
    D: '#64748b', // gray
  };

  return (
    <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl shadow-2xl border border-slate-800 w-full font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Epidemiologic Curves</h2>
          <p className="text-slate-400 text-sm mt-1">SEIRD trajectories over 90 days with P10/P90 confidence bounds</p>
        </div>
        
        <div className="flex flex-col gap-3">
          {/* City Toggle */}
          <select 
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2 outline-none"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          {/* Scenario Toggles */}
          <div className="inline-flex rounded-lg shadow-sm bg-slate-900 p-1" role="group">
            {scenarios.map((scenario) => (
              <button
                key={scenario}
                type="button"
                onClick={() => setSelectedScenario(scenario)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  selectedScenario === scenario
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {scenario.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="day" 
              stroke="#64748b" 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              label={{ value: 'Days Since Outbreak', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 14 }}
              domain={[0, 90]}
              type="number"
            />
            <YAxis 
              stroke="#64748b" 
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(val)}
              label={{ value: 'Population', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 14 }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
              itemStyle={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}
              labelStyle={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}
              formatter={(value, name) => {
                if (Array.isArray(value)) {
                   return [`${new Intl.NumberFormat('en-US').format(value[0])} - ${new Intl.NumberFormat('en-US').format(value[1])}`, name];
                }
                return [new Intl.NumberFormat('en-US').format(value), name];
              }}
              labelFormatter={(label) => `Day ${label}`}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            
            {/* Confidence Band for I (P10 to P90) */}
            <Area 
              type="monotone" 
              dataKey="confidenceRange" 
              fill={colors.I} 
              fillOpacity={0.15} 
              stroke="none" 
              name="Infectious Range (P10-P90)"
              activeDot={false}
              isAnimationActive={false}
            />
            
            <Line type="monotone" dataKey="S" stroke={colors.S} strokeWidth={2} dot={false} name="Susceptible (S)" isAnimationActive={false} />
            <Line type="monotone" dataKey="E" stroke={colors.E} strokeWidth={2} dot={false} name="Exposed (E)" isAnimationActive={false} />
            <Line type="monotone" dataKey="I" stroke={colors.I} strokeWidth={3} dot={false} name="Infectious (I)" activeDot={{ r: 6, fill: colors.I, stroke: '#020617', strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="R" stroke={colors.R} strokeWidth={2} dot={false} name="Recovered (R)" isAnimationActive={false} />
            <Line type="monotone" dataKey="D" stroke={colors.D} strokeWidth={2} dot={false} name="Dead (D)" isAnimationActive={false} />

            {peakDay > 0 && (
              <ReferenceLine 
                x={peakDay} 
                stroke={colors.I} 
                strokeOpacity={0.7}
                strokeDasharray="4 4" 
                label={{ 
                  position: 'insideTopLeft', 
                  value: `Peak Infection (Day ${peakDay})`, 
                  fill: colors.I, 
                  fontSize: 12,
                  fontWeight: 600,
                  offset: 10
                }} 
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SEIRChart;
