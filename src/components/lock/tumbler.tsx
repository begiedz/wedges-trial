import Pin from "./pin";

export default function Tumbler() {
  return (
    <div className="flex gap-4 bg-[#AAA8A6] px-8 py-2 rounded-xs w-fit">
      <Pin />
      <Pin />
      <Pin />
      <Pin />
      <Pin />
      <Pin />
      <Pin />
    </div>
  );
}
