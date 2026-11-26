import { Button } from "@/components/ui/button";
import type { LockState } from "@/game/types";
import { useDebugDictionary } from "@/i18n/provider";

type PinTableProps = {
  lock: LockState | null;
  onSelect: (pinId: number) => void;
  selectedPinId: number | null;
};

export function PinTable({ lock, onSelect, selectedPinId }: PinTableProps) {
  const t = useDebugDictionary();
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">{t.labels.pin}</th>
            <th className="px-4 py-3 font-medium">{t.labels.position}</th>
            <th className="px-4 py-3 font-medium">{t.labels.target}</th>
            <th className="px-4 py-3 font-medium">{t.labels.range}</th>
            <th className="px-4 py-3 font-medium">{t.actions.selectPin}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white/90 dark:divide-zinc-800 dark:bg-zinc-950/80">
          {lock?.pins.map((pin) => {
            const isSelected = pin.id === selectedPinId;
            const isOnTarget = pin.position === pin.target;

            return (
              <tr
                className={
                  isSelected
                    ? "bg-amber-500/10"
                    : isOnTarget
                      ? "bg-emerald-500/10"
                      : ""
                }
                key={pin.id}
              >
                <td className="px-4 py-3 font-mono text-zinc-950 dark:text-zinc-100">
                  #{pin.id}
                </td>
                <td className="px-4 py-3 font-mono text-zinc-950 dark:text-zinc-100">
                  {pin.position}
                </td>
                <td className="px-4 py-3 font-mono text-zinc-950 dark:text-zinc-100">
                  {pin.target}
                </td>
                <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                  {pin.min}..{pin.max}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    disabled={lock.isFailed}
                    onClick={() => onSelect(pin.id)}
                    type="button"
                  >
                    {t.actions.selectPin}
                  </Button>
                </td>
              </tr>
            );
          })}
          {!lock ? (
            <tr>
              <td
                className="px-4 py-6 text-zinc-500 dark:text-zinc-400"
                colSpan={5}
              >
                {t.messages.idle}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
