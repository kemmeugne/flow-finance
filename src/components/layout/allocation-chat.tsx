'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, ChevronDown } from 'lucide-react'

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
          <MessageCircle className="w-4 h-4 text-sage-600" />
          <span className="text-sm font-medium text-sage-800">Ask Claude about this allocation</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-sage-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="flex flex-col bg-background">
          <div className="flex flex-col gap-3 px-4 py-4 min-h-[120px] max-h-72 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Ask me why I made these suggestions, or request a different approach.
              </p>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sage-600 text-white rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm text-muted-foreground">
                  Thinking…
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
