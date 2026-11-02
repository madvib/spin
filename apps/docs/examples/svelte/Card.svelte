<script lang="ts">
  import { SUBJECT_HTML, type Subject } from "../shared.ts";
  let { subject }: { subject: Subject } = $props();
</script>

<div>{@html SUBJECT_HTML[subject]}</div>
