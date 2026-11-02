import Image, { type StaticImageData } from "next/image";
import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A product screenshot in a quiet navy-700 browser-style frame (three dots, the first one a gold
 * "active" dot, + optional address label),
 * with the brand frame shadow and an optional caption. With `zoom`, the image becomes a button
 * that opens the full-size screenshot in a Dialog.
 *
 * @example
 * <ScreenshotFrame src="/marketing/office.png" alt="The office floor with four employees at work"
 *   width={1440} height={900} label="Office" caption="Lamps mark live work." zoom />
 */
export function ScreenshotFrame({
  src,
  alt,
  width,
  height,
  priority = false,
  label,
  caption,
  zoom = false,
  sizes = "(min-width: 1200px) 1100px, 100vw",
  className,
}: {
  src: string | StaticImageData;
  alt: string;
  width: number;
  height: number;
  /** Preload (use only for the above-the-fold LCP image). */
  priority?: boolean;
  /** Short text shown in the frame's address bar, e.g. "Office". */
  label?: string;
  caption?: ReactNode;
  zoom?: boolean;
  sizes?: string;
  className?: string;
}) {
  const image = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      preload={priority}
      className="block h-auto w-full"
    />
  );

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-navy-800 shadow-frame">
        <div className="flex h-9 items-center gap-3 border-b border-white/10 bg-navy-700 px-3.5" aria-hidden>
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-gold" />
            <span className="size-2.5 rounded-full bg-navy-600" />
            <span className="size-2.5 rounded-full bg-navy-600" />
          </span>
          {label ? <span className="truncate rounded-sm bg-navy px-2.5 py-0.5 text-xs text-mist">{label}</span> : null}
        </div>
        {zoom ? (
          <Dialog>
            <DialogTrigger
              className="group relative block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold"
              aria-label={`Enlarge screenshot: ${alt}`}
            >
              {image}
              <span className="absolute right-3 bottom-3 inline-flex size-9 items-center justify-center rounded-full bg-navy/80 text-snow opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 className="size-4" aria-hidden />
              </span>
            </DialogTrigger>
            <DialogContent title={label ?? "Screenshot"} description={caption ? caption : undefined} className="max-w-[min(1400px,calc(100vw-2rem))]">
              <Image src={src} alt={alt} width={width} height={height} sizes="95vw" className="block h-auto w-full rounded-md" />
            </DialogContent>
          </Dialog>
        ) : (
          image
        )}
      </div>
      {caption ? <figcaption className="text-sm leading-relaxed text-current/75">{caption}</figcaption> : null}
    </figure>
  );
}
