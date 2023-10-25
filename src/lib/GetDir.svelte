<script lang="ts">
  import { fs } from "@tauri-apps/api";
  import { desktopDir } from "@tauri-apps/api/path";

  type File = {
    name: string;
    path: string;
    chiledren?: File[];
  };

  let listFiles: File[] = [];
  let fullSelectedPath: string = "";
  let selectedFile: string = "";

  async function getDesktop() {
    const desktopPath = await desktopDir();
    listFiles = await fs.readDir(desktopPath, { recursive: true });

    console.log("desktopPath", desktopPath);
    console.log("listFiless", listFiles);
  }

  async function readSelectedFile() {
    selectedFile = await fs.readTextFile(fullSelectedPath);
    console.log("file", selectedFile);
  }
  getDesktop();
</script>

<div>
  {#each listFiles as listFile}
    <button
      on:click={async () => {
        fullSelectedPath = listFile.path;
        await readSelectedFile();
      }}>{listFile.name}</button
    >
  {/each}
  <p>fullSelectedPath: {fullSelectedPath}</p>
  <p>selectedFile: {selectedFile}</p>
</div>
