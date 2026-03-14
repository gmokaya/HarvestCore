import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { resolveUser } from "./middleware/auth";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(resolveUser);

app.use("/api", router);

export default app;
