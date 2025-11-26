import { defineApp } from "convex/server";
import component from "devwithbobby/loops/convex.config";

const app = defineApp();
app.use(component);

export default app;
