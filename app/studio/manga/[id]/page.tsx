"use client";
import { use } from "react";
import { Editor } from "@/components/editor/Editor";
import { Gate } from "@/components/Gate";

export default function MangaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Gate>
      <Editor id={id} />
    </Gate>
  );
}
