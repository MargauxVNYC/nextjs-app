"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function DeletePostButton({
                                             batchId,
                                             imageUrl,
                                         }: {
    batchId: string;
    imageUrl: string | null;
}) {
    const router = useRouter();
    const supabase = createClient();
    const [busy, setBusy] = useState(false);

    async function remove() {
        if (!confirm("Delete this post and its captions? This can't be undone.")) return;
        setBusy(true);

        // RLS only allows deleting your own rows.
        const { error } = await supabase.from("generations").delete().eq("batch_id", batchId);
        if (error) {
            alert(`Couldn't delete: ${error.message}`);
            setBusy(false);
            return;
        }

        // Remove the uploaded photo from Storage too.
        const path = imageUrl?.split("/storage/v1/object/public/uploads/")[1];
        if (path) {
            await supabase.storage.from("uploads").remove([decodeURIComponent(path)]);
        }

        router.refresh();
    }

    return (
        <button className="post-delete" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "🗑 Delete"}
        </button>
    );
}