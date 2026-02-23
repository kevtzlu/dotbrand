"use client"

import { useState } from 'react'
import { FileText, FileSpreadsheet, FileCode, Presentation, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import * as XLSX from "xlsx"
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx"
import pptxgen from "pptxgenjs"
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

    const exportPDF = async () => {
        setIsExporting('pdf')
        setStatusMessage(null)
        try {
            const element = document.getElementById('pdf-content')
            if (!element) {
                throw new Error("Could not find content to export (pdf-content element missing).")
            }

            const canvas = await html2canvas(element, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            })

            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')

            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = pdf.internal.pageSize.getHeight()

            const imgWidth = pdfWidth
            const imgHeight = (canvas.height * imgWidth) / canvas.width

            let heightLeft = imgHeight
            let position = 0

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
            heightLeft -= pdfHeight

            // Add more pages if needed
            while (heightLeft > 0) {
                pdf.addPage()
                position = heightLeft - imgHeight
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                heightLeft -= pdfHeight
            }

            const blob = pdf.output('blob')
            triggerDownload(blob, `${projectName}.pdf`)
        } catch (err: any) {
            console.error("PDF Export failed", err)
            setStatusMessage({ type: 'error', text: `PDF 下載失敗: ${err.message || '請重試'}` })
        } finally {
            setIsExporting(null)
        }
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

    const exportWord = async () => {
        setIsExporting('word')
        setStatusMessage(null)
        try {
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: projectName,
                                    bold: true,
                                    size: 32,
                                }),
                            ],
                        }),
                        ...messages.map(m => new Paragraph({
                            children: [
                                new TextRun({
                                    text: `${m.role === 'assistant' ? 'Estimait AI' : 'User'}: `,
                                    bold: true,
                                }),
                                new TextRun(m.content),
                            ],
                            spacing: { before: 200 },
                        }))
                    ],
                }],
            })

            const blob = await Packer.toBlob(doc)
            triggerDownload(blob, `${projectName}.docx`)
        } catch (err: any) {
            console.error("Word Export failed", err)
            setStatusMessage({ type: 'error', text: `WORD 下載失敗: ${err.message || '請重試'}` })
        } finally {
            setIsExporting(null)
        }
    }

    const exportPPT = async () => {
        setIsExporting('ppt')
        setStatusMessage(null)
        try {
            const pres = new pptxgen()
            pres.layout = "LAYOUT_WIDE"

            // Title Slide
            const slide = pres.addSlide()
            slide.addText("PROJECT ESTIMATION REPORT", { x: 1, y: 1.5, w: 8, h: 1, fontSize: 44, bold: true, color: "363636" })
            slide.addText(projectName, { x: 1, y: 2.5, w: 8, h: 1, fontSize: 32, color: "0078d4" })

            // Content Slides
            messages.forEach((m, idx) => {
                if (m.role === 'assistant' && idx > 1) { // Skip welcome message
                    const s = pres.addSlide()
                    s.addText(`Finding ${idx / 2}`, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: "363636" })
                    s.addText(m.content.slice(0, 500) + "...", { x: 0.5, y: 1.2, w: 9, h: 4, fontSize: 14, color: "666666" })
                }
            })

            const buffer = await pres.write({ outputType: 'blob' })
            triggerDownload(buffer as Blob, `${projectName}.pptx`)
        } catch (err: any) {
            console.error("PPT Export failed", err)
            setStatusMessage({ type: 'error', text: `SLIDES 下載失敗: ${err.message || '請重試'}` })
        } finally {
            setIsExporting(null)
        }
    }

    return (
        <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl my-6">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                <Download className="w-4 h-4 text-primary" /> 📄 Export Final Report
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                    onClick={exportPDF}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:border-primary transition-all disabled:opacity-50"
                >
                    {isExporting === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3 text-red-500" />} PDF
                </button>
                <button
                    onClick={exportExcel}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:border-emerald-500 transition-all disabled:opacity-50"
                >
                    {isExporting === 'excel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 text-emerald-500" />} EXCEL
                </button>
                <button
                    onClick={exportWord}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:border-blue-500 transition-all disabled:opacity-50"
                >
                    {isExporting === 'word' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCode className="w-3 h-3 text-blue-500" />} WORD
                </button>
                <button
                    onClick={exportPPT}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:border-orange-500 transition-all disabled:opacity-50"
                >
                    {isExporting === 'ppt' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Presentation className="w-3 h-3 text-orange-500" />} SLIDES
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
