"use client"

import { useState } from "react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, ComposedChart, Line, PieChart, Pie, Legend, LineChart
} from 'recharts'
import { AlertTriangle, PanelRightClose, MapPin, Building2, Ruler, Thermometer, Zap, Factory, BarChart3 } from "lucide-react"
import { EstimationData } from "@/app/page";

interface ChartPanelProps {
    className?: string;
    onClose?: () => void;
    data: EstimationData | null;
}


function RiskAccordion({ risks }: { risks?: { title: string; description: string }[] }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    if (!risks?.length) {
        return (
            <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" /> Critical Risk Drivers
                </h3>
                <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-800 text-xs text-center w-full text-gray-400 leading-relaxed">
                    ⚠️ 請完成 Stage E 風險評估以載入風險項目
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Critical Risk Drivers
            </h3>
            <div className="flex flex-col gap-2">
                {risks.map((risk, i) => (
                    <div key={i} className="rounded-xl border border-orange-100 dark:border-orange-900/40 overflow-hidden">
                        <button
                            onClick={() => setOpenIdx(openIdx === i ? null : i)}
                            className="w-full flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 text-xs font-semibold text-left hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
                        >
                            <span className="shrink-0">⚠️</span>
                            <span className="flex-1 break-words">{risk.title}</span>
                            <span className="shrink-0 text-orange-400 ml-1">{openIdx === i ? "▲" : "▼"}</span>
                        </button>
                        {openIdx === i && risk.description && (
                            <div className="px-4 py-3 bg-white dark:bg-orange-950/10 text-xs text-gray-600 dark:text-gray-400 leading-relaxed border-t border-orange-100 dark:border-orange-900/30">
                                {risk.description}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ChartPanel({ className, onClose, data }: ChartPanelProps) {
    const isMonteCarlo = !data?.chartType || data?.chartType === 'monte-carlo';

    const formatCurrency = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
    const formatSFCost = (total: number, gfa: string | undefined) => {
        if (!gfa) return "";
        const numericGFA = parseFloat(gfa.replace(/,/g, ''));
        return numericGFA > 0 ? `$${(total / numericGFA).toFixed(2)} / SF` : "";
    };

    return (
        <div className={`h-full bg-panel-bg border-l border-panel-border overflow-y-auto flex flex-col ${className}`}>
            {!data ? null : (
                <>

                    {/* Sticky Header */}
                    <div className="p-5 border-b border-panel-border shrink-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2 break-words leading-tight">
                                {data.projectName || "Project Overview"}
                            </h2>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                {data.location && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-500 uppercase tracking-wider font-medium break-words">
                                        <MapPin className="w-3 h-3 shrink-0" /> {data.location}
                                    </div>
                                )}
                                {data.gfa && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                        <Ruler className="w-3 h-3" /> {data.gfa}
                                    </div>
                                )}
                                {data.buildingType && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                        <Building2 className="w-3 h-3" /> {data.buildingType}
                                    </div>
                                )}
                            </div>
                        </div>
                        {onClose && (
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <PanelRightClose className="w-5 h-5 text-gray-400" />
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-8 flex-1">
                        {isMonteCarlo ? (
                            <>
                                {/* Main Stats: P10, P50, P80 */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 text-center">
                                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Optimistic P10</div>
                                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(data.p10)}</div>
                                        <div className="text-[10px] text-emerald-600/60 mt-1 font-medium">{formatSFCost(data.p10, data.gfa)}</div>
                                    </div>
                                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 text-center ring-4 ring-blue-500/10 scale-105">
                                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Most Likely P50</div>
                                        <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(data.p50)}</div>
                                        <div className="text-[10px] text-blue-600/60 mt-1 font-medium">{formatSFCost(data.p50, data.gfa)}</div>
                                    </div>
                                    <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 rounded-2xl p-4 text-center">
                                        <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-2">Conservative P80</div>
                                        <div className="text-2xl font-black text-orange-700 dark:text-orange-300">{formatCurrency(data.p80)}</div>
                                        <div className="text-[10px] text-orange-600/60 mt-1 font-medium">{formatSFCost(data.p80, data.gfa)}</div>
                                    </div>
                                </div>

                                {/* Histogram */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <BarChart3 aria-hidden="true" className="w-4 h-4 text-primary" /> Cost Distribution Frequency
                                    </h3>
                                    <div className="h-48 w-full bg-white dark:bg-[#121214] rounded-2xl border border-panel-border p-4 shadow-sm">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data.histogram}>
                                                <XAxis dataKey="cost" hide />
                                                <Tooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="frequency" radius={[4, 4, 0, 0]}>
                                                    {data.histogram?.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#10b981' : index > 8 ? '#f97316' : '#3b82f6'} opacity={0.8} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Probability Range / Confidence Interval */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold flex items-center gap-2">Confidence Range (P10 - P80)</h3>
                                    <div className="relative h-12 flex items-center px-4 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                        <div className="absolute left-0 right-0 h-1.5 bg-gray-200 dark:bg-gray-800" />
                                        <div
                                            className="absolute h-3 bg-gradient-to-r from-emerald-400 via-blue-500 to-orange-400 rounded-full"
                                            style={{ left: '10%', right: '10%' }}
                                        />
                                        <div className="relative flex justify-between w-full text-[9px] font-black uppercase text-gray-500">
                                            <span>{formatCurrency(data.p10)}</span>
                                            <span className="text-blue-500">{formatCurrency(data.p50)}</span>
                                            <span>{formatCurrency(data.p80)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Horizontal Breakdown */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold">P50 Category Breakdown</h3>
                                    <div className="grid gap-3">
                                        {data.breakdown?.map((item, i) => (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-semibold gap-2">
                                                    <span className="text-gray-600 dark:text-gray-400 break-words flex-1">{item.name}</span>
                                                    <span className="shrink-0">{formatCurrency(item.value)} ({(item.value / data.p50 * 100).toFixed(0)}%)</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary/60 rounded-full"
                                                        style={{ width: `${(item.value / data.p50 * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Risk Drivers */}
                                <RiskAccordion risks={data.risks} />
                            </>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <BarChart3 aria-hidden="true" className="w-4 h-4 text-primary" />
                                    {data.chartType === 'pie' ? 'Distribution Breakdown' :
                                        data.chartType === 'line' ? 'Trend Analysis' : 'Comparison Analytics'}
                                </h3>

                                <div className="h-[300px] w-full bg-white dark:bg-[#121214] rounded-2xl border border-panel-border p-4 shadow-sm">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {data.chartType === 'pie' ? (
                                            <PieChart>
                                                <Pie
                                                    data={data.chartData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                                >
                                                    {data.chartData?.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={[
                                                            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
                                                        ][index % 6]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        ) : data.chartType === 'line' ? (
                                            <LineChart data={data.chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                <XAxis dataKey="name" />
                                                <YAxis tickFormatter={(val) => `$${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val}`} />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                                            </LineChart>
                                        ) : (
                                            <BarChart data={data.chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                <XAxis dataKey="name" />
                                                <YAxis tickFormatter={(val) => `$${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val}`} />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>

                                {/* Data Table */}
                                <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-panel-border p-4">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-gray-500 text-left border-b border-gray-200 dark:border-gray-800">
                                                <th className="pb-2 font-medium">Category</th>
                                                <th className="pb-2 font-medium text-right">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.chartData?.map((item, i) => (
                                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                                                    <td className="py-2.5 font-medium">{item.name}</td>
                                                    <td className="py-2.5 text-right font-mono">
                                                        {typeof item.value === 'number' ?
                                                            (item.value > 1000 ? `$${item.value.toLocaleString()}` : `${item.value}%`)
                                                            : item.value}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 bg-gray-50 dark:bg-[#0a0a0c] border-t border-panel-border shrink-0">
                        <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest font-black">
                            <span>Simulation: Monte Carlo</span>
                            <span>Iterations: 10,000</span>
                            <span>Source: dotbrand REAL™</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
