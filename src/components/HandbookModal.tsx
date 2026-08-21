import { X } from "lucide-react";
import { MIN_CAPTURE, PROBE_RADIUS, TEMPERS, TEMPER_DEFS } from "../game/constants";

interface Props {
  onClose: () => void;
  assist: boolean;
  onAssist: (on: boolean) => void;
}

export function HandbookModal({ onClose, assist, onAssist }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lumon employee handbook"
      className="absolute inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-[1px]"
      onPointerDown={(ev) => {
        ev.stopPropagation();
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="max-h-[82%] overflow-y-auto rounded-t-[6px] border-t-2 border-phos-500 bg-phos-950/97 px-4 pb-5 pt-3 shadow-[0_-8px_40px_rgba(23,168,102,0.25)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="crt-text-glow text-[13px] font-bold tracking-[0.2em] text-phos-200">
              MACRODATA REFINEMENT
            </h2>
            <p className="text-[9px] tracking-[0.16em] text-phos-600">
              EMPLOYEE HANDBOOK · SECTION IV
            </p>
          </div>
          <button
            type="button"
            aria-label="Close handbook"
            onClick={onClose}
            className="rounded-[3px] border border-phos-600 p-1.5 text-phos-400"
          >
            <X size={14} />
          </button>
        </div>

        <p className="mb-4 text-[10px] leading-relaxed text-phos-400">
          The numbers on your screen are frightening, and you are the only one
          who can feel it. Probe the file, find the clusters that stir, and
          consign each to the temper it evokes. Please enjoy each number
          equally.
        </p>

        <ol className="mb-4 space-y-1.5 text-[10px] leading-relaxed text-phos-400">
          <li>
            <span className="text-phos-300">01 · PROBE.</span> Hold a finger to
            the matrix. The reticle floats above your fingertip. Within{" "}
            {PROBE_RADIUS}px of a cluster the digits begin to move, sound, and
            buzz.
          </li>
          <li>
            <span className="text-phos-300">02 · SELECT.</span> Double-tap the
            screen, or use the SELECT switch, then drag a box around the
            agitated digits. {MIN_CAPTURE} or more lifts the cluster into a data
            packet.
          </li>
          <li>
            <span className="text-phos-300">03 · REFINE.</span> Drag the packet
            into the matching temper bin. A correct assignment fills that bin.
            A mistake scatters the data back to the grid.
          </li>
        </ol>

        <h3 className="crt-text-glow mb-2 text-[10px] font-bold tracking-[0.2em] text-phos-300">
          THE FOUR TEMPERS
        </h3>
        <ul className="space-y-2">
          {TEMPERS.map((t) => {
            const def = TEMPER_DEFS[t];
            return (
              <li
                key={t}
                className="rounded-[3px] border-l-2 bg-phos-900/50 py-1.5 pl-2.5 pr-2"
                style={{ borderColor: def.css }}
              >
                <div
                  className="text-[10px] font-bold tracking-[0.18em]"
                  style={{ color: def.css }}
                >
                  {def.code} · {def.name} ({t})
                </div>
                <div className="text-[9px] leading-snug text-phos-400">
                  {def.blurb}
                </div>
                <div className="text-[9px] italic leading-snug text-phos-600">
                  {def.signature}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 rounded-[3px] border border-phos-700 bg-phos-900/40 p-2.5">
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-[10px] font-bold tracking-[0.16em] text-phos-300">
                COLOUR ASSIST
              </span>
              <span className="block text-[9px] leading-snug text-phos-600">
                Tint agitated clusters with their temper's colour. Kier
                considers this a crutch.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={assist}
              onClick={() => onAssist(!assist)}
              className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
                assist
                  ? "border-phos-400 bg-phos-600"
                  : "border-phos-700 bg-phos-950"
              }`}
            >
              <span
                className={`block h-3.5 w-3.5 rounded-full bg-phos-200 transition-transform ${
                  assist ? "translate-x-[18px]" : "translate-x-[2px]"
                }`}
              />
            </button>
          </label>
        </div>

        <p className="mt-4 text-center text-[8px] tracking-[0.22em] text-phos-700">
          THE WORK IS MYSTERIOUS AND IMPORTANT
        </p>
      </div>
    </div>
  );
}
