"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  LeaderboardClaimRequest,
  LeaderboardQualification,
} from "@/api/contracts";
import { TransportError } from "@/client/game/api";
import {
  getLeaderboardEligibility,
  submitLeaderboardEntry,
} from "@/client/game/leaderboard";
import { useGameDictionary } from "@/i18n/provider";
import { DialogAction } from "./game-dialog";

type Status =
  | "checking"
  | "ready"
  | "submitting"
  | "network"
  | "expired"
  | "invalid"
  | "claimed"
  | "unavailable";

/** Mounted only for a server-confirmed finish; keyed by run ID by the caller. */
export function LeaderboardClaim({ runId }: { runId: string }) {
  const t = useGameDictionary().leaderboardClaim;
  const id = useId();
  const [status, setStatus] = useState<Status>("checking");
  const [reason, setReason] = useState<LeaderboardQualification>();
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<LeaderboardClaimRequest | null>(null);
  const busy = useRef(false);
  const wasEligible = useRef(false);
  const alive = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly requests a fresh eligibility snapshot.
  useEffect(() => {
    alive.current = true;
    let active = true;
    setStatus("checking");
    getLeaderboardEligibility(runId)
      .then((result) => {
        if (!active) return;
        wasEligible.current = result.eligible;
        setReason(result);
        setStatus(result.eligible ? "ready" : "unavailable");
      })
      .catch((error: unknown) => {
        if (active)
          setStatus(
            error instanceof TransportError &&
              [401, 403, 404].includes(error.status)
              ? "expired"
              : "network",
          );
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [runId, attempt]);

  async function submit() {
    if (busy.current) return;
    const name = nickname.trim();
    if (
      !pending.current &&
      (!name || [...name].length > 24 || /[\p{Cc}\p{Cs}]/u.test(name))
    ) {
      setStatus("invalid");
      return;
    }
    pending.current ??= { actionId: crypto.randomUUID(), nickname: name };
    busy.current = true;
    setStatus("submitting");
    try {
      const reply = await submitLeaderboardEntry(runId, pending.current);
      if (!alive.current) return;
      pending.current = null;
      if (reply.outcome === "leaderboard_claimed") {
        setDisplayName(reply.entry.displayName);
        setStatus("claimed");
      } else {
        setReason(reply.qualification);
        setStatus("unavailable");
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof TransportError && error.status === 400) {
        pending.current = null;
        setStatus("invalid");
      } else if (
        error instanceof TransportError &&
        [401, 403, 404].includes(error.status)
      ) {
        setStatus("expired");
      } else setStatus("network");
    } finally {
      busy.current = false;
    }
  }

  const formVisible =
    status === "ready" ||
    status === "invalid" ||
    status === "submitting" ||
    (status === "network" && !!pending.current);
  return (
    <section
      className="space-y-3"
      aria-label={t.title}
      aria-busy={status === "checking" || status === "submitting"}
    >
      <output className="block">
        {status === "checking"
          ? t.checking
          : status === "expired"
            ? t.expired
            : status === "network"
              ? t.network
              : status === "claimed"
                ? t.saved
                : status === "unavailable"
                  ? reason &&
                    !reason.eligible &&
                    reason.reason === "already_claimed"
                    ? t.alreadyClaimed
                    : wasEligible.current
                      ? t.noLongerQualified
                      : t.notQualified
                  : t.qualified}
      </output>
      {status === "claimed" && <p className="break-words">{displayName}</p>}
      {formVisible && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          <label htmlFor={id} className="block">
            {t.nickname}
          </label>
          <input
            id={id}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            readOnly={!!pending.current}
            autoComplete="off"
            aria-describedby={`${id}-help`}
            aria-invalid={status === "invalid"}
            className="w-full min-w-0 border border-border bg-background px-3 py-2"
          />
          <p id={`${id}-help`} className="text-sm text-muted-foreground">
            {t.help}
          </p>
          {status === "invalid" && <p role="alert">{t.invalid}</p>}
          <DialogAction type="submit" disabled={status === "submitting"}>
            {status === "submitting"
              ? t.submitting
              : pending.current
                ? t.retry
                : t.submit}
          </DialogAction>
        </form>
      )}
      {status === "network" && !pending.current && (
        <DialogAction onClick={() => setAttempt((value) => value + 1)}>
          {t.retry}
        </DialogAction>
      )}
    </section>
  );
}
