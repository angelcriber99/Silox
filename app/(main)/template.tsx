export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
      {children}
    </div>
  )
}
