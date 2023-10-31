<script lang="ts">
  import { fs } from "@tauri-apps/api";
  import { desktopDir } from "@tauri-apps/api/path";
  import * as loadImage from "blueimp-load-image";

  type File = {
    name: string;
    path: string;
    chiledren?: File[];
  };

  let listFiles: File[] = [];
  let fullSelectedPath: string = "";
  let selectedFileBinary: Uint8Array;
  let blob: Blob;
  let blobURL: string;
  let selectedImg: HTMLImageElement;

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
    blob = new Blob([selectedFileBinary], {
      type: "image/jpg",
    });
    blobURL = URL.createObjectURL(blob);
  }
  getDesktop();

  $: {
    if (blobURL && selectedImg) {
      console.log("blob", blob);
      loadImage.parseMetaData(
        blob,
        function (data) {
          console.log("data", data);
          console.log("Original image head: ", data.imageHead);
          console.log("Exif data: ", data.exif); // requires exif extension
          console.log("IPTC data: ", data.iptc); // requires iptc extension
        },
        {
          maxMetaDataSize: 262144,
        }
      );
    }
  }

  let input;

  function onChange() {
    const file = input.files[0];

    if (file) {
      console.log("file", file);

      loadImage.parseMetaData(
        file,
        function (data) {
          console.log("data", data);
          console.log("Original image head: ", data.imageHead);
          console.log("Exif data: ", data.exif); // requires exif extension
          console.log("IPTC data: ", data.iptc); // requires iptc extension
        },
        {
          maxMetaDataSize: 262144,
        }
      );

      // const reader = new FileReader();
      // reader.addEventListener("load", function () {
      //   image.setAttribute("src", reader.result);
      // });
      // reader.readAsDataURL(file);

      // return;
    }
  }
</script>

<div>
  <input
    type="file"
    name="filetest"
    id="filetest"
    on:change={onChange}
    bind:this={input}
  />
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
  {#if blobURL}
    <img src={blobURL} alt="" srcset="" bind:this={selectedImg} />
  {/if}
</div>
