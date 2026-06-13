import React, { useState, useMemo, useEffect } from 'react';

const ResourceAllocator = ({ cityStatus = [], resources = {}, onExport }) => {
  // Setup default total resource pools
  const totalResources = {
    ventilators: resources.ventilators || 0,
    icu_beds: resources.icu_beds || 0,
    medical_teams: resources.medical_teams || 0,
    vaccine_doses: resources.vaccine_doses || 0,
  };

  const resourceKeys = Object.keys(totalResources);
  
  // Sort cities by peak day ascending (earliest peaks first)
  const sortedCities = useMemo(() => {
    return [...cityStatus].sort((a, b) => (a.peak_infection_day || 0) - (b.peak_infection_day || 0));
  }, [cityStatus]);

  // Allocation state: { city_id: { ventilators: 0, icu_beds: 0, ... } }
  const [allocations, setAllocations] = useState({});

  // Initialize allocations map on load
  useEffect(() => {
    const initial = {};
    sortedCities.forEach(city => {
      initial[city.node_id] = { ventilators: 0, icu_beds: 0, medical_teams: 0, vaccine_doses: 0 };
    });
    setAllocations(initial);
  }, [sortedCities]);

  // Calculate current allocated running totals
  const allocatedTotals = useMemo(() => {
    const totals = { ventilators: 0, icu_beds: 0, medical_teams: 0, vaccine_doses: 0 };
    Object.values(allocations).forEach(cityAlloc => {
      resourceKeys.forEach(key => {
        totals[key] += (parseInt(cityAlloc[key]) || 0);
      });
    });
    return totals;
  }, [allocations, resourceKeys]);

  const handleAllocationChange = (nodeId, resourceKey, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setAllocations(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        [resourceKey]: numValue
      }
    }));
  };

  const handleAutoAllocate = () => {
    // 1. Identify priority cities (overwhelmed). If none, use all cities.
    const targetCities = sortedCities.filter(c => c.overwhelmed).length > 0 
      ? sortedCities.filter(c => c.overwhelmed) 
      : sortedCities;

    const totalInfections = targetCities.reduce((sum, c) => sum + (c.projected_I_p50 || 0), 0);
    
    if (totalInfections === 0) return;

    const newAllocations = {};
    // Zero out all cities first
    sortedCities.forEach(city => {
      newAllocations[city.node_id] = { ventilators: 0, icu_beds: 0, medical_teams: 0, vaccine_doses: 0 };
    });

    // Track remainders to prevent rounding losses
    const remainders = { ...totalResources };

    // Proportional distribution based on projected P50 infections
    targetCities.forEach(city => {
      const proportion = (city.projected_I_p50 || 0) / totalInfections;
      resourceKeys.forEach(key => {
        const amount = Math.floor(proportion * totalResources[key]);
        newAllocations[city.node_id][key] = amount;
        remainders[key] -= amount;
      });
    });

    // Dump remaining fractions into the hardest-hit city in the target group
    if (targetCities.length > 0) {
      const highestHitCity = [...targetCities].sort((a, b) => b.projected_I_p50 - a.projected_I_p50)[0];
      resourceKeys.forEach(key => {
        if (remainders[key] > 0) {
           newAllocations[highestHitCity.node_id][key] += remainders[key];
        }
      });
    }

    setAllocations(newAllocations);
  };

  const formatResourceName = (name) => {
    return name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl w-full font-sans text-slate-200">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Resource Deployment Scheduler</h2>
          <p className="text-slate-400 text-sm mt-1">Distribute medical supplies prioritized by earliest peak day and overwhelm status</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleAutoAllocate}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition-colors shadow-sm"
          >
            Auto-Allocate
          </button>
          <button 
            onClick={() => onExport && onExport(allocations)}
            className="flex-1 md:flex-none px-4 py-2 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-400 hover:text-cyan-100 text-sm font-semibold rounded-lg border border-cyan-800 transition-colors shadow-[0_0_10px_rgba(8,145,178,0.15)] hover:shadow-[0_0_15px_rgba(8,145,178,0.3)]"
          >
            Export Plan
          </button>
        </div>
      </div>

      {/* Resource Running Totals Deck */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {resourceKeys.map(key => {
          const total = totalResources[key];
          const allocated = allocatedTotals[key];
          const isOver = allocated > total;
          const percentage = total > 0 ? Math.min(100, (allocated / total) * 100) : 0;

          return (
            <div key={key} className="bg-slate-900 p-4 rounded-xl border border-slate-800/60 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{formatResourceName(key)}</span>
                <span className={`text-xs font-mono font-bold ${isOver ? 'text-red-400' : 'text-slate-300'}`}>
                  {allocated.toLocaleString()} / {total.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className={`h-full transition-all duration-300 ${isOver ? 'bg-red-500' : (percentage > 90 ? 'bg-amber-500' : 'bg-cyan-500')}`}
                  style={{ width: `${isOver ? 100 : percentage}%` }}
                />
              </div>
              {isOver && <p className="text-[10px] text-red-400 mt-1.5 font-medium animate-pulse">Exceeds available supply!</p>}
            </div>
          );
        })}
      </div>

      {/* Compact Allocation Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-sm custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 border-r border-slate-800/50">District / City</th>
              <th className="px-4 py-3 text-center">Peak Day</th>
              <th className="px-4 py-3">Infections vs Capacity</th>
              <th className="px-4 py-3 text-center border-r border-slate-800/50">Status</th>
              <th className="px-3 py-3 text-center">Ventilators</th>
              <th className="px-3 py-3 text-center">ICU Beds</th>
              <th className="px-3 py-3 text-center">Med Teams</th>
              <th className="px-3 py-3 text-center">Vaccines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sortedCities.map(city => {
              const capRatio = (city.projected_I_p50 || 0) / (city.bed_capacity || 1);
              const isOverwhelmed = city.overwhelmed;

              return (
                <tr key={city.node_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 border-r border-slate-800/50">
                    <div className="font-semibold text-slate-200">{city.city_name}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">{city.node_id}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-slate-300">
                    Day {city.peak_infection_day}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-slate-300" title="Projected Infections">{Math.round(city.projected_I_p50).toLocaleString()}</span>
                      <span className="text-slate-500" title="Bed Capacity">{Math.round(city.bed_capacity).toLocaleString()}</span>
                    </div>
                    <div className="w-40 max-w-full bg-slate-900 border border-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${isOverwhelmed ? 'bg-red-500' : (capRatio > 0.15 ? 'bg-amber-500' : 'bg-emerald-500')}`}
                        style={{ width: `${Math.min(100, capRatio * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center border-r border-slate-800/50">
                    {isOverwhelmed ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/40 text-red-400 border border-red-800/50 shadow-sm">
                        OVERWHELMED
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/20 text-emerald-500 border border-emerald-800/30">
                        SAFE
                      </span>
                    )}
                  </td>
                  
                  {/* Allocation Inputs */}
                  {resourceKeys.map(key => {
                    const val = allocations[city.node_id]?.[key] || '';
                    return (
                      <td key={key} className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-16 bg-slate-950 border border-slate-700 hover:border-slate-600 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors text-right shadow-inner"
                          value={val === 0 ? '' : val}
                          onChange={(e) => handleAllocationChange(city.node_id, key, e.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {sortedCities.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-slate-500 text-sm">
                  No city data available for scheduling.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Hide number input spinners for cleaner UI */
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
};

export default ResourceAllocator;
