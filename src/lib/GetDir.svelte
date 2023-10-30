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
  let selectedFileBinary: Uint8Array;
  let blobURL: string;

  async function getDesktop() {
    const desktopPath = await desktopDir();
    listFiles = await fs.readDir(`${desktopPath}photofolder-samples`, {
      recursive: true,
    });

    console.log("desktopPath", desktopPath);
    console.log("listFiless", listFiles);
  }

  async function readSelectedFile() {
    // selectedFile = await fs.readTextFile(fullSelectedPath);
    selectedFileBinary = await fs.readBinaryFile(fullSelectedPath);
    var b = new Blob([selectedFileBinary], {
      type: "application/octet-stream",
    });
    blobURL = URL.createObjectURL(b);
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
  <p>blobURL: {blobURL}</p>
  <!-- <p>selectedFileBinary: {selectedFileBinary}</p> -->
  <img src={blobURL} alt="" srcset="" />
</div>
