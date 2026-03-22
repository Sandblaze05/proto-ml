'use client'

const RegisterForm = ({ onClose = () => { } }) => {
  return (
    <div onClick={() => onClose()} className="fixed inset-0 backdrop-blur-[2px]">
      <div onClick={(e) => e.stopPropagation()} className="absolute left-1/2 top-1/2 -translate-1/2 h-150 w-90 sm:h-180 sm:w-120 bg-background border-2 border-foreground">
        <div className="border border-foreground absolute inset-3 flex flex-col items-center py-2 gap-3">
          <h1 className="font-mono font-bold text-4xl mt-10 tracking-widest">Get Started</h1>
          <span className="font-semibold">— or —</span>
          <h1 className="font-mono font-bold text-4xl tracking-widest">Continue</h1>
          <div className="h-px w-2/3 bg-foreground" />

          <form className="mt-5 flex flex-col items-center w-full px-9 gap-5">
            <input type="email" name="email" placeholder="example@gmail.com" className="w-full h-14 focus:outline-0 px-2 py-1 border-3 border-foreground rounded-lg" />
            <input type="password" name="password" placeholder="password" className="w-full h-14 focus:outline-0 px-2 py-1 border-3 border-foreground rounded-lg" />
            <button className="w-full h-14 bg-foreground hover:bg-foreground/80 transition-colors rounded-full text-background font-bold font-mono text-lg cursor-pointer">Login</button>
          </form>
        </div>
      </div>

    </div>
  )
}

export default RegisterForm