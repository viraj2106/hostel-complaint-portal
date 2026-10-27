// Hostel Complaint Portal — S2: Node.js + Express APIs
//   POST /api/complaints  -> submit a complaint
//   GET  /api/complaints  -> retrieve all complaints

const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "complaints.json");

const CATEGORIES = ["Electrical", "Plumbing", "Cleaning", "Wi-Fi", "Furniture", "Other"];

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serves the S1 frontend

// ---------- simple JSON-file storage ----------

async function readComplaints() {
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
}

async function writeComplaints(complaints) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(complaints, null, 2));
}

// Serialise writes so two simultaneous submissions can't overwrite each other.
let queue = Promise.resolve();
function enqueue(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
}

// ---------- validation ----------

function validate(body) {
    const errors = [];
    const str = (v) => (typeof v === "string" ? v.trim() : "");

    const name = str(body.name);
    const room = str(body.room);
    const category = str(body.category);
    const description = str(body.description);
    const date = str(body.date);

    if (!name) errors.push("name is required");
    if (!room) errors.push("room is required");
    if (!category) errors.push("category is required");
    else if (!CATEGORIES.includes(category))
        errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
    if (!description) errors.push("description is required");
    if (!date) errors.push("date is required");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
        errors.push("date must be a valid YYYY-MM-DD date");

    return { errors, value: { name, room, category, description, date } };
}

// ---------- API routes ----------

// Submit a complaint
app.post("/api/complaints", async (req, res, next) => {
    try {
        const { errors, value } = validate(req.body || {});
        if (errors.length) {
            return res.status(400).json({ success: false, errors });
        }

        const complaint = await enqueue(async () => {
            const complaints = await readComplaints();
            const newComplaint = {
                id: Date.now(),
                ...value,
                status: "Pending",
                createdAt: new Date().toISOString(),
            };
            complaints.unshift(newComplaint); // newest first
            await writeComplaints(complaints);
            return newComplaint;
        });

        res.status(201).json({ success: true, complaint });
    } catch (err) {
        next(err);
    }
});

// Retrieve all complaints
app.get("/api/complaints", async (req, res, next) => {
    try {
        const complaints = await readComplaints();
        res.json(complaints);
    } catch (err) {
        next(err);
    }
});
// Update complaint status
app.patch("/api/complaints/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const status = req.body?.status;

        if (!["Pending", "Resolved"].includes(status)) {
            return res.status(400).json({
                success: false,
                errors: ["status must be Pending or Resolved"],
            });
        }

        const updatedComplaint = await enqueue(async () => {
            const complaints = await readComplaints();
            const index = complaints.findIndex((c) => c.id === id);

            if (index === -1) return null;

            complaints[index].status = status;
            complaints[index].updatedAt = new Date().toISOString();

            await writeComplaints(complaints);
            return complaints[index];
        });

        if (!updatedComplaint) {
            return res.status(404).json({
                success: false,
                errors: ["Complaint not found"],
            });
        }

        res.json({
            success: true,
            complaint: updatedComplaint,
        });
    } catch (err) {
        next(err);
    }
});

// Delete a complaint
app.delete("/api/complaints/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        const deletedComplaint = await enqueue(async () => {
            const complaints = await readComplaints();
            const index = complaints.findIndex((c) => c.id === id);

            if (index === -1) return null;

            const deleted = complaints[index];
            complaints.splice(index, 1);

            await writeComplaints(complaints);
            return deleted;
        });

        if (!deletedComplaint) {
            return res.status(404).json({
                success: false,
                errors: ["Complaint not found"],
            });
        }

        res.json({
            success: true,
            complaint: deletedComplaint,
        });
    } catch (err) {
        next(err);
    }
});

// ---------- error handling ----------

app.use("/api", (req, res) => {
    res.status(404).json({ success: false, errors: ["API route not found"] });
});

app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, errors: ["Invalid JSON body"] });
    }
    console.error(err);
    res.status(500).json({ success: false, errors: ["Internal server error"] });
});

app.listen(PORT, () => {
    console.log(`Hostel Complaint Portal running at http://localhost:${PORT}`);
});
    