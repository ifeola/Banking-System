import { config } from "dotenv";
import createApp from "./app.ts";

config();
const app = createApp();
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
	console.log(`Server is running on localhost:${PORT}`);
});
