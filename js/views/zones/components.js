// js/views/zones/components.js

export const renderHeader = (bio) => {
    return `
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8 relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-10">
                <i class="fa-solid fa-bolt text-9xl text-yellow-500"></i>
            </div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Fitness</h2>
                    <div class="flex items-baseline gap-2">
                        <span class="text-4xl font-black text-white">${bio.wkgNum.toFixed(2)}</span>
                        <span class="text-sm font-bold text-slate-400">W/kg</span>
                    </div>
                    <div class="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-900 border" 
                         style="color: ${bio.category.color}; border-color: ${bio.category.color}40">
                        ${bio.category.label}
                    </div>
                </div>

                <div class="flex gap-8 text-center">
                    <div class="flex flex-col">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">FTP (W)</span>
                        <span class="text-lg font-bold text-white leading-none">${bio.watts}</span>
                    </div>
                    <div class="flex flex-col border-l border-slate-700 pl-8">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Weight (lbs)</span>
                        <span class="text-lg font-bold text-white leading-none">${bio.weight}</span>
                    </div>
                    <div class="flex flex-col border-l border-slate-700 pl-8">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Pace (FTP)</span>
                        <span class="text-lg font-bold text-white leading-none">${bio.runFtp}</span>
                    </div>
                    <div class="flex flex-col border-l border-slate-700 pl-8">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">LTHR</span>
                        <span class="text-lg font-bold text-white leading-none">${bio.lthr}</span>
                    </div>
                    <div class="flex flex-col border-l border-slate-700 pl-8">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">5K Est</span>
                        <span class="text-lg font-bold text-white leading-none">${bio.fiveK}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export const renderFtpButton = () => `
    <div class="text-center mt-12 mb-4 h-20 flex items-center justify-center">
        <button onclick="this.parentElement.innerHTML='<span class=&quot;text-6xl font-black text-emerald-500 animate-bounce block&quot;>67</span>'" 
                class="px-8 py-3 bg-slate-800 border border-slate-700 rounded-full text-slate-500 hover:text-white hover:border-emerald-500 hover:bg-slate-700 transition-all text-sm font-bold uppercase tracking-widest shadow-lg">
            Reveal Calculated VO2 Max
        </button>
    </div>
`;
