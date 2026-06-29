type PinProps = {
  isOnTarget?: boolean;
};
export default function Pin({ isOnTarget = false }: PinProps) {
  return (
    <div
      className={[
        "size-5 rounded-full border transition-colors duration-300",
        isOnTarget ? "bg-[#A63F50]" : "bg-[#94876F]",
      ].join(" ")}
    />
  );
}
