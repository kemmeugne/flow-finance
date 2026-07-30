'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, ChevronDown, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AllocatedCategory {
  name: string
  amount: number
  reasoning: string
  currentBalance: number
  targetAmount: number
  group: string
}

export interface SkippedCategory {
  name: string
  skipReason: string
}

interface Props {
  income: number
  allocations: AllocatedCategory[]
  summary: string | null
  skippedCategories: SkippedCategory[]
}

export function AllocationChat({ income, allocations, summary, skippedCategories }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          context: { income, allocations, summary, skippedCategories },
        }),
      })
      if (res.ok) {
        const { message } = await res.json() as { message: string }
        setMessages(prev => [...prev, { role: 'assistant', content: message }])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-sage-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-sage-50 hover:bg-sage-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sage-600" />
          <span className="text-sm font-medium text-sage-800">Ask Claude about this allocation</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-sage-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="flex flex-col bg-background">
          <div className="flex flex-col gap-3 px-4 py-4 min-h-[120px] max-h-80 overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Sparkles className="w-5 h-5 text-sage-400" />
                <p className="text-xs text-muted-foreground">
                  Ask me why I made these suggestions, or request a different approach.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                  {['Why was my emergency fund skipped?', 'Prioritise my rent this month', 'Explain your reasoning'].map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="text-xs px-2.5 py-1 rounded-full border border-sage-200 text-sage-700 hover:bg-sage-50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="shrink-0 w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center mt-0.5">
                    <Sparkles className="w-3 h-3 text-sage-600" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sage-600 text-white rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-sage max-w-none
                      [&_p]:mb-2 [&_p:last-child]:mb-0
                      [&_ul]:mb-2 [&_ul]:pl-4 [&_ul:last-child]:mb-0
                      [&_ol]:mb-2 [&_ol]:pl-4 [&_ol:last-child]:mb-0
                      [&_li]:mb-0.5
                      [&_strong]:font-semibold [&_strong]:text-sage-900
                      [&_code]:bg-sage-100 [&_code]:text-sage-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                      [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mb-1
                      [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1
                      [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center mt-0.5">
                  <Sparkles className="w-3 h-3 text-sage-600 animate-pulse" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Why did you skip my emergency fund?"
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
