import { useState } from "react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [semester, setSemester] = useState("");

  const handleFile = (selected) => {
    if (!selected) return;
    if (
      selected.type.startsWith("image/") ||
      selected.type.startsWith("audio/")
    ) {
      alert("Images & Audio not allowed");
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !subject || !topic || !semester) {
      return alert("All fields required");
    }
    const filePath = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("noteflow-files")
      .upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      return alert("Upload failed");
    }
    const { data } = supabase.storage
      .from("noteflow-files")
      .getPublicUrl(filePath);
    const fileUrl = data.publicUrl;
    try {
      await api.post("/api/notes", {
        title: topic,
        subject,
        semester,
        description: "",
        fileUrl,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    } catch (err) {
      console.error(err);
      return alert(err.response?.data?.message || "DB Save Failed");
    }
    alert("Uploaded Successfully ✅");
    setFile(null);
    setSubject("");
    setTopic("");
    setSemester("");
  };

  return (
    <div className="mx-auto max-w-md p-6 mt-8 rounded-xl bg-white/80 dark:bg-card/70 shadow-lg">
      <h2 className="font-display text-2xl font-bold mb-6 text-primary">Upload Notes</h2>
      <form className="space-y-4">
        <input
          type="text"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-card/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input
          type="text"
          placeholder="Topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-card/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={semester}
          onChange={e => setSemester(e.target.value)}
          className="w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-card/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="" disabled>Select Semester</option>
          {[...Array(8)].map((_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mt-2 p-6 text-center border-2 border-dashed border-primary/40 rounded-2xl bg-muted/60 dark:bg-card/50 transition hover:border-primary/70 cursor-pointer"
        >
          <span className="text-base text-slate-700 dark:text-slate-200">
            {file ? file.name : "Drag & Drop File Here"}
          </span>
        </div>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.zip,.rar,.csv,.xlsx,.ppt,.pptx"
          onChange={(e) => handleFile(e.target.files[0])}
          className="block w-full mt-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:font-semibold file:cursor-pointer"
        />
        <button
          type="button"
          onClick={handleUpload}
          className="w-full mt-4 py-2 rounded-xl bg-primary text-white font-bold text-lg shadow hover:bg-primary/90 transition"
        >
          Upload
        </button>
      </form>
    </div>
  );
}
