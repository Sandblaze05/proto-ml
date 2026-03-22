'use client'

import { useState } from "react"
import RegisterForm from "@/components/RegisterForm";

export default function Home() {
  const [formOpen, setFormOpen] = useState(false);



  return (
    <main className="flex flex-col min-w-screen min-h-screen">
      {formOpen && (
        <RegisterForm onClose={() => setFormOpen(false)} />
      )}
      <header className="flex items-center justify-between underline underline-offset-7 decoration-2 px-4 py-2 h-17 border-b border-b-[#faebd7]">
        <span>
          <h1 className="font-mono font-extrabold text-3xl">proto-ML</h1>
        </span>

        <div 
          onClick={() => setFormOpen(true)}
          className="rounded-full cursor-pointer px-4 py-2 bg-[#faebd7] text-lg font-mono hover:underline 
                    decoration-2 underline-offset-1 font-bold text-black flex items-center justify-center"
          >
          <span>Login</span>
        </div>
      </header>
    </main>
  )
}