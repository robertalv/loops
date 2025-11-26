import component from "devwithbobby/loops/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(component);

export default app;
