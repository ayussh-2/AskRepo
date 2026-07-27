import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  srcDir: "src",
  imports: false,
  manifest: {
    name: "askRepo",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzuF5DJQj2IhYG3alU/1PGReVcztk+QJnjY+9LBKFcUvhUGxFYl3Y9lJEfFvPDrO6D7BgZtmqDm98XGy+dhy627w2WBgj+Rm6rQGq+O/RFbrTF6g8eQE8gJba7tm+OeI19BmguWbxBldfxM8oyGuuZc4Brz6p7XPswvx5Z2JILYFMaq9v4AKjwPuX02IQVshsXLTreJ9bBEMYe5JqjShZOB5V7DYFyvJSwzeTcbm9py9Ds4KW5RELSKdVTDREOYOsr+TdCEsZhTYvkhqtJKFunYv6+8khvBz677nVGDvP96QW3mLXgkKw2YBHeU2ZeHs3v5FHodcfuBWa90TGpTuUQQIDAQAB",
    permissions: ["activeTab", "identity", "storage"],
  },
});
