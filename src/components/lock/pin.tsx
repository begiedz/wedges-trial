function PinHole({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center items-center bg-background rounded-full size-5">
      {children}
    </div>
  );
}

export default function Pin() {
  // pin - #94876F
  // middle pin - #A63F50
  return (
    <PinHole>
      <div className="bg-[#94876F] rounded-full size-4" />
    </PinHole>
  );
}
