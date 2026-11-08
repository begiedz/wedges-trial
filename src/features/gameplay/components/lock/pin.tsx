type PinProps = {
  isOnTarget?: boolean;
};
export default function Pin({ isOnTarget = false }: PinProps) {
  return (
    <div
      className={[
        "size-3 rounded-full border border-black/30 shadow-[0_0_0_2px_rgba(33,31,33,0.2)] transition-colors duration-300",
        isOnTarget ? "bg-[#A63F50]" : "bg-[#94876F]",
      ].join(" ")}
    />
  );
}
