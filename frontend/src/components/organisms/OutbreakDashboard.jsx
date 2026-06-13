import React, { useState, useMemo } from 'react';
import IndiaMap from './IndiaMap';
import SEIRChart from './SEIRChart';
import ScenarioComparator from './ScenarioComparator';
import ResourceAllocator from './ResourceAllocator';

const OutbreakDashboard = ({ dashboardData }) => {
  // Destructure payload with fallback defaults
  const {
    eventId = 'EVT-000000',
    dataConfidence = 'HIGH', // LOW, MEDIUM, HIGH
    profileVersion = 'v1.0.0',
    lastRunTime = new Date().toISOString(),
    cityStatus = [],
    lockdownLinks = [],
    scenarios = [],
    resources = { ventilators: 0, icu_beds: 0, medical_teams: 0, vaccine_doses: 0 },
    seird_results = [],
    confidence_bands = []
  } = dashboardData || {};

  // Global UI State
  const [selectedCity, setSelectedCity] = useState(cityStatus[0]?.city_name || 'KA-01 Bengaluru Urban');
  const [selectedScenario, setSelectedScenario] = useState('no_lockdown');

  // Computed state for banners and downstream components
  const hasOverwhelmedCities = useMemo(() => {
    return cityStatus.some(city => city.overwhelmed);
  }, [cityStatus]);

  // Derive which links are currently cut based on the selected scenario
  const selectedLinks = useMemo(() => {
    const currentScenarioData = scenarios.find(
      s => s.name.toLowerCase().includes(selectedScenario.replace('_', ' '))
    );
    if (!currentScenarioData || !currentScenarioData.top_links_cut) return [];
    
    // Convert source-dest pairs into link_ids assuming standard naming, 
    // or return link_id directly if it exists in the payload
    return currentScenarioData.top_links_cut.map(l => l.link_id || `${l.source_city}-${l.dest_city}`);
  }, [scenarios, selectedScenario]);

  // Data Confidence Badge Style Helper
  const getConfidenceColor = (conf) => {
    const confLower = conf.toLowerCase();
    if (confLower === 'low') return 'bg-red-900/40 text-red-400 border-red-800';
    if (confLower === 'medium') return 'bg-amber-900/40 text-amber-400 border-amber-800';
    return 'bg-emerald-900/40 text-emerald-400 border-emerald-800';
  };

  const handleExport = (allocationPlan) => {
    console.log("Allocating Resources:", allocationPlan);
    alert("Resource deployment plan dispatched to Command Center.");
  };

  return (
    <div className="min-h-screen font-sans text-slate-200" style={{ backgroundColor: '#0a0f1e' }}>
      
      {/* OS Navigation Header */}
      <header className="border-b border-emerald-900/30 bg-[#070b16] px-6 py-4 shadow-md sticky top-0 z-50">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          
          {/* Identity & Metadata */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-widest text-emerald-400">OUTBREAK RESPONSE OS</h1>
            </div>
            
            <div className="hidden md:block h-6 w-px bg-slate-700/60 mx-1"></div>
            
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs md:text-sm bg-slate-800/80 px-2 py-1 rounded border border-slate-700 text-slate-300">
                {eventId}
              </span>
              <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${getConfidenceColor(dataConfidence)}`}>
                DATA CONF: {dataConfidence}
              </span>
            </div>
          </div>

          {/* Global Controls & Status */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-emerald-500/70 w-full xl:w-auto justify-between xl:justify-end">
            <div className="flex flex-col items-start xl:items-end uppercase tracking-wider">
              <span>PROFILE: {profileVersion}</span>
              <span>LAST RUN: {lastRunTime}</span>
            </div>
            
            <div className="hidden md:block h-8 w-px bg-slate-700/60 mx-1"></div>
            
            {/* Global Dropdowns */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold hidden md:block">Focus Node:</label>
                <select 
                  className="bg-[#0a0f1e] border border-emerald-800/60 text-emerald-400 text-xs md:text-sm font-semibold rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 outline-none font-sans"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                >
                  {cityStatus.map(city => (
                    <option key={city.node_id} value={city.city_name}>{city.city_name}</option>
                  ))}
                  <option disabled value="">-----------------</option>
                  {cityStatus.length === 0 && <option value="KA-01 Bengaluru Urban">KA-01 Bengaluru Urban (Fallback)</option>}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold hidden md:block">Strategy:</label>
                <select 
                  className="bg-[#0a0f1e] border border-emerald-800/60 text-emerald-400 text-xs md:text-sm font-semibold rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 outline-none font-sans"
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                >
                  <option value="no_lockdown">No Lockdown (Baseline)</option>
                  <option value="partial">Partial Quarantine</option>
                  <option value="full">Full Lockdown</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Critical Alert Banner */}
      {(dataConfidence.toLowerCase() === 'low' || hasOverwhelmedCities) && (
        <div className="bg-red-950/40 border-b border-red-800/60 px-6 py-2.5 flex items-center justify-center text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] shadow-[0_4px_15px_rgba(239,68,68,0.1)] transition-all">
          <svg className="w-4 h-4 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          System Alert: 
          {dataConfidence.toLowerCase() === 'low' && " Intelligence profile data confidence is critically LOW. "}
          {hasOverwhelmedCities && " One or more regional hubs are currently projecting absolute healthcare saturation."}
        </div>
      )}

      {/* Main Orchestration Grid */}
      <main className="p-4 md:p-6 w-full max-w-[1920px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          
          {/* Left Column (40%) - Spatiotemporal Intelligence */}
          <div className="w-full lg:w-2/5 flex flex-col gap-6">
            <div className="flex-1 h-full min-h-[450px]">
              <IndiaMap 
                cityStatus={cityStatus} 
                lockdownLinks={lockdownLinks} 
                selectedLinks={selectedLinks} 
              />
            </div>
            <div className="flex-none">
              <ScenarioComparator 
                scenarios={scenarios} 
                onSelectScenario={(scen) => {
                  const scenLower = scen.toLowerCase();
                  if (scenLower.includes('partial')) setSelectedScenario('partial');
                  else if (scenLower.includes('full')) setSelectedScenario('full');
                  else setSelectedScenario('no_lockdown');
                }}
              />
            </div>
          </div>
          
          {/* Right Column (60%) - Compartmental Analytics & Resource Logistics */}
          <div className="w-full lg:w-3/5 flex flex-col gap-6">
            <div className="flex-none">
              <SEIRChart 
                data={{ seird_results, confidence_bands }} 
                selectedCity={selectedCity} 
                selectedScenario={selectedScenario} 
              />
            </div>
            <div className="flex-1">
              <ResourceAllocator 
                cityStatus={cityStatus} 
                resources={resources} 
                onExport={handleExport}
              />
            </div>
          </div>
          
        </div>
      </main>

      {/* Global overrides to ensure mono numbers everywhere in the dash */}
      <style dangerouslySetInnerHTML={{__html: `
        span, p, div, text {
          font-variant-numeric: tabular-nums;
        }
      `}} />
    </div>
  );
};

export default OutbreakDashboard;
