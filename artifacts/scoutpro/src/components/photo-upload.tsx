import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export async function uploadPhotoFile(file: File): Promise<string> {
  const metaRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!metaRes.ok) throw new Error(`request-url failed: ${metaRes.status}`);
  const { uploadURL, objectPath } = (await metaRes.json()) as { uploadURL: string; objectPath: string };
  // Do NOT set Content-Type header on the PUT — the presigned URL only signs the host header
  const put = await fetch(uploadURL, { method: "PUT", body: file });
  if (!put.ok) throw new Error(`upload failed: ${put.status}`);
  return `/api/storage${objectPath}`;
}

export function PhotoUpload({
  value,
  onChange,
  shape = "circle",
  size = "md",
  placeholder,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  shape?: "circle" | "square";
  size?: "sm" | "md" | "lg";
  placeholder?: string;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const sizeClass = size === "sm" ? "h-16 w-16" : size === "lg" ? "h-28 w-28" : "h-20 w-20";
  const radiusClass = shape === "circle" ? "rounded-full" : "rounded-xl";
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPhotoFile(file);
      onChange(url);
      toast({ title: "Imagen subida correctamente" });
    } catch (err) {
      console.error("photo upload error", err);
      toast({ title: "Error al subir la foto", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`relative ${sizeClass} ${radiusClass} overflow-hidden border-2 border-dashed border-muted-foreground/30 bg-muted hover:border-primary hover:bg-primary/5 transition-colors group flex items-center justify-center`}
      >
        {value ? (
          <img src={value} alt="foto" className="w-full h-full object-cover absolute inset-0" />
        ) : (
          <span className={`font-display text-muted-foreground/50 ${textSize} select-none`}>
            {placeholder ?? "?"}
          </span>
        )}
        <div className={`absolute inset-0 ${radiusClass} bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
          {uploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>
      </button>
      <span className="text-xs text-muted-foreground">
        {uploading ? "Subiendo…" : "Cambiar foto"}
      </span>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}
