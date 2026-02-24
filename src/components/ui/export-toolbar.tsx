"use client"

import { useState } from 'react'
import { FileSpreadsheet, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import * as XLSX from "xlsx"
import { Message } from "@/app/page"

interface ExportToolbarProps {
    messages: Message[];
    projectName?: string;
}

export function ExportToolbar({ messages, projectName = "Estimait-Report" }: ExportToolbarProps) {
    const [isExporting, setIsExporting] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

    const triggerDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    const exportExcel = () => {
        setIsExporting('excel')
        setStatusMessage(null)
        try {
            // Extract all tables from assistant messages
            const tables: any[][] = []
            messages.forEach(msg => {
                if (msg.role === 'assistant') {
                    const tableRegex = /\|(.+)\|.*\n\|(?:[\s-]*:?[\s-]*\|)+\n((?:\|.*\|\n?)+)/g
                    let match
                    while ((match = tableRegex.exec(msg.content)) !== null) {
                        const headers = match[1].split('|').map(h => h.trim()).filter(Boolean)
                        const rows = match[2].trim().split('\n').map(r => r.split('|').map(c => c.trim()).filter(Boolean))
                        if (headers.length > 0 && rows.length > 0) {
                            tables.push([headers, ...rows])
                        }
                    }
                }
            })

            const wb = XLSX.utils.book_new()
            let hasAddedData = false

            tables.forEach((table, idx) => {
                if (table.length > 0) {
                    const ws = XLSX.utils.aoa_to_sheet(table)
                    XLSX.utils.book_append_sheet(wb, ws, `Table ${idx + 1}`)
                    hasAddedData = true
                }
            })

            if (!hasAddedData) {
                // Fallback: just export messages
                const data = messages.map(m => ({ Role: m.role, Content: m.content }))
                const ws = XLSX.utils.json_to_sheet(data)
                XLSX.utils.book_append_sheet(wb, ws, "Messages")
            }

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            triggerDownload(blob, `${projectName}.xlsx`)
        } catch (err: any) {
            console.error("Excel Export failed", err)
            setStatusMessage({ type: 'error', text: `EXCEL 下載失敗: ${err.message || '請重試'}` })
        } finally {
            setIsExporting(null)
        }
    }

    return (
        <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl my-6">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                <Download className="w-4 h-4 text-primary" /> 📄 Export Final Report
            </div>

            <div className="flex gap-2">
                <button
                    onClick={exportExcel}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:border-emerald-500 transition-all disabled:opacity-50"
                >
                    {isExporting === 'excel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 text-emerald-500" />} EXCEL
                </button>
            </div>

            <p className="text-[10px] text-gray-500 font-medium">
                Generates a professional report containing all estimation stages, charts, and final recommendations.
            </p>

            {statusMessage && (
                <div className={`mt-2 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${statusMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
                    }`}>
                    {statusMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {statusMessage.text}
                </div>
            )}
        </div>
    )
}
