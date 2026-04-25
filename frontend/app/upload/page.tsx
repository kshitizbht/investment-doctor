"use client";

import { useRouter } from "next/navigation";
import UploadDropzone from "@/components/UploadDropzone";

export default function UploadPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <button onClick={() => router.push("/")} className="text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </button>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Upload Statement</h1>
          <p className="text-sm text-neutral-500">Upload a brokerage PDF to add positions and transactions.</p>
        </div>
        <UploadDropzone onSuccess={() => router.push("/")} />
      </div>
    </main>
  );
}
