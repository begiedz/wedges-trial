import Tumbler from "./tumbler";

export default function Lock() {
  return (
    <div className="flex flex-col gap-1">
      <Tumbler />
      <Tumbler />
      <Tumbler />
      <Tumbler />
    </div>
  );
}
