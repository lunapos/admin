// 売上伝票をレシート形式で表示する。
//
// POSで実際に印字されるものと同じ体裁にしてあり、
// 「あの日のレシートをもう一度見たい／出したい」に応えるためのもの。
// 印刷はブラウザの印刷機能を使う（レシート幅に合わせたスタイルを当てる）。

import { useState } from 'react'
import { Receipt, Printer, X } from 'lucide-react'
import { buildReceiptText } from '../lib/receiptFormat'
import type { ReceiptStore, ReceiptPayment, ReceiptItem } from '../lib/receiptFormat'

interface Props {
  store: ReceiptStore | null
  payment: ReceiptPayment
  items: ReceiptItem[]
}

export default function ReceiptPreview({ store, payment, items }: Props) {
  const [open, setOpen] = useState(false)

  // 店舗情報が未取得でもレシートは出せるようにする（店名だけ既定値）
  const effectiveStore: ReceiptStore = store ?? {
    name: 'Luna POS',
    address: null,
    phone: null,
    invoiceRegistrationNumber: null,
    taxRate: 0.1,
  }

  const text = buildReceiptText(effectiveStore, payment, items)

  function handlePrint() {
    // 一覧ごと印刷されないよう、レシートだけの別ウィンドウを開く
    const w = window.open('', '_blank', 'width=420,height=700')
    if (!w) return
    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>レシート</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { margin: 0; }
  pre {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 11px; line-height: 1.45;
    white-space: pre; margin: 0;
  }
</style></head>
<body><pre>${text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))}</pre>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`)
    w.document.close()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] text-[#d4b870] hover:underline flex items-center gap-1"
      >
        <Receipt size={10} /> レシート表示
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#9090bb]">レシート</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="text-[10px] text-[#d4b870] hover:underline flex items-center gap-1"
          >
            <Printer size={10} /> 印刷
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-[10px] text-[#9090bb] hover:underline flex items-center gap-1"
          >
            <X size={10} /> 閉じる
          </button>
        </div>
      </div>

      {/* 実物に近づけるため白背景・等幅で出す */}
      <div className="bg-white rounded-lg p-4 overflow-x-auto">
        <pre className="text-black text-[10px] leading-[1.45] font-mono whitespace-pre">
          {text}
        </pre>
      </div>

      {!store && (
        <p className="text-[10px] text-[#9090bb]">
          店舗設定に住所・電話が未入力のため、発行者欄が省略されています。
        </p>
      )}
    </div>
  )
}
