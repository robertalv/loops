import aggregate from "@convex-dev/aggregate/convex.config";
import { defineComponent } from "convex/server";

const component = defineComponent("loops");

component.use(aggregate, { name: "contactAggregate" });

export default component;
