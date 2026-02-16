import { useState } from "react";
import { supabase } from "../lib/supabase";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [semester, setSemester] = useState("");

  const handleFile = (selected) => {
    if (!selected) return;

    // ❌ Block images & audio
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

    // 1️⃣ Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from("files")
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      return alert("Upload failed");
    }

    // 2️⃣ Get Public URL
    const { data } = supabase.storage
      .from("files")
      .getPublicUrl(filePath);

    const fileUrl = data.publicUrl;

    // 3️⃣ Save metadata to DB
    const { error: dbError } = await supabase.from("notes").insert([
      {
        subject,
        topic,
        semester,
        file_url: fileUrl,
      },
    ]);

    if (dbError) {
      console.error(dbError);
      return alert("DB Save Failed");
    }

    alert("Uploaded Successfully ✅");
    setFile(null);
    setSubject("");
    setTopic("");
    setSemester("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload Notes</h2>

      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <input
        type="text"
        placeholder="Topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />

      <input
        type="text"
        placeholder="Semester"
        value={semester}
        onChange={(e) => setSemester(e.target.value)}
      />

      {/* Drag & Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          marginTop: "10px",
          padding: "20px",
          border: "2px dashed gray",
        }}
      >
        {file ? file.name : "Drag & Drop File Here"}
      </div>

      {/* File Select Option */}
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip,.rar,.csv,.xlsx,.ppt,.pptx"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}
