// Hostel Complaint Portal - Frontend Logic

const API_URL = "/api/complaints";

// ---------- Utility Functions ----------

function formatDate(isoDate) {
    if (!isoDate) return "";

    const [y, m, d] = isoDate.split("-");

    if (!y || !m || !d) return isoDate;

    return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
}


// ---------- Complaint Form ----------

function initComplaintForm() {

    const form = document.getElementById("complaintForm");

    if (!form) return;

    const successMessage = document.getElementById("successMessage");

    function showMessage(text, isError) {

        successMessage.textContent = text;

        successMessage.classList.toggle("error", isError);

        clearTimeout(form._msgTimeout);

        form._msgTimeout = setTimeout(() => {
            successMessage.textContent = "";
        }, 4000);
    }

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        const data = {

            name: document.getElementById("name").value.trim(),

            room: document.getElementById("room").value.trim(),

            category: document.getElementById("category").value,

            description: document.getElementById("description").value.trim(),

            date: document.getElementById("date").value

        };

        if (
            !data.name ||
            !data.room ||
            !data.category ||
            !data.description ||
            !data.date
        ) {

            showMessage("Please fill in all fields.", true);

            return;
        }

        try {

            const response = await fetch(API_URL, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(data)

            });

            const result = await response.json();

            if (!response.ok) {

                showMessage(
                    (result.errors || ["Could not submit complaint."]).join(", "),
                    true
                );

                return;
            }

            form.reset();

            showMessage(
                "Complaint submitted successfully!",
                false
            );

        } catch (err) {

            showMessage(
                "Could not reach the server. Is it running?",
                true
            );

        }

    });
}


// ---------- Complaints Data ----------

let allComplaints = [];


// ---------- Load Complaints ----------

async function loadComplaints() {

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Request failed");
        }

        allComplaints = await response.json();

        updateStatistics();

        renderComplaints();

    } catch (err) {

        const tbody = document.getElementById("complaintsBody");

        if (tbody) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7"
                        style="text-align:center; color:#c0392b;">
                        Could not load complaints.
                        Is the server running?
                    </td>
                </tr>
            `;
        }

    }
}


// ---------- Statistics ----------

function updateStatistics() {

    const totalCount = document.getElementById("totalCount");

    const pendingCount = document.getElementById("pendingCount");

    const resolvedCount = document.getElementById("resolvedCount");

    if (!totalCount) return;

    const total = allComplaints.length;

    const pending = allComplaints.filter(
        complaint => complaint.status === "Pending"
    ).length;

    const resolved = allComplaints.filter(
        complaint => complaint.status === "Resolved"
    ).length;

    totalCount.textContent = total;

    pendingCount.textContent = pending;

    resolvedCount.textContent = resolved;
}


// ---------- Render Complaints ----------

function renderComplaints() {

    const tbody = document.getElementById("complaintsBody");

    if (!tbody) return;

    const searchInput = document.getElementById("searchInput");

    const categoryFilter = document.getElementById("categoryFilter");

    const statusFilter = document.getElementById("statusFilter");

    const searchText = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const selectedCategory = categoryFilter
        ? categoryFilter.value
        : "";

    const selectedStatus = statusFilter
        ? statusFilter.value
        : "";


    const filteredComplaints = allComplaints.filter(complaint => {

        const searchMatch =

            complaint.name.toLowerCase().includes(searchText) ||

            complaint.room.toLowerCase().includes(searchText) ||

            complaint.description.toLowerCase().includes(searchText);


        const categoryMatch =

            !selectedCategory ||
            complaint.category === selectedCategory;


        const statusMatch =

            !selectedStatus ||
            complaint.status === selectedStatus;


        return searchMatch &&
               categoryMatch &&
               statusMatch;

    });


    if (filteredComplaints.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7"
                    style="text-align:center; color:#777;">
                    No complaints found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML = filteredComplaints.map(complaint => {

        const statusClass =
            complaint.status === "Resolved"
                ? "resolved"
                : "pending";


        const actionText =
            complaint.status === "Resolved"
                ? "↩ Mark Pending"
                : "✓ Resolve";


        return `

            <tr>

                <td>
                    ${escapeHtml(complaint.name)}
                </td>

                <td>
                    ${escapeHtml(complaint.room)}
                </td>

                <td>
                    ${escapeHtml(complaint.category)}
                </td>

                <td>
                    ${escapeHtml(complaint.description)}
                </td>

                <td>
                    ${formatDate(complaint.date)}
                </td>

                <td>
                    <span class="status ${statusClass}">
                        ${escapeHtml(complaint.status)}
                    </span>
                </td>

                <td>

                    <div class="actions">

                        <button
                            class="action-btn toggle-btn"
                            onclick="toggleStatus(${complaint.id})">

                            ${actionText}

                        </button>


                        <button
                            class="action-btn delete-btn"
                            onclick="deleteComplaint(${complaint.id})">

                            🗑 Delete

                        </button>

                    </div>

                </td>

            </tr>

        `;

    }).join("");

}


// ---------- Toggle Status ----------

async function toggleStatus(id) {

    const complaint = allComplaints.find(
        c => c.id === id
    );

    if (!complaint) return;


    const newStatus =
        complaint.status === "Resolved"
            ? "Pending"
            : "Resolved";


    try {

        const response = await fetch(
            `${API_URL}/${id}`,
            {

                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status: newStatus
                })

            }
        );


        const result = await response.json();


        if (!response.ok) {

            alert(
                (result.errors || ["Could not update complaint."])
                .join(", ")
            );

            return;
        }


        await loadComplaints();


    } catch (err) {

        alert(
            "Could not reach the server."
        );

    }

}


// ---------- Delete Complaint ----------

async function deleteComplaint(id) {

    const complaint = allComplaints.find(
        c => c.id === id
    );

    if (!complaint) return;


    const confirmed = confirm(
        `Are you sure you want to delete the complaint from ${complaint.name}?`
    );


    if (!confirmed) return;


    try {

        const response = await fetch(
            `${API_URL}/${id}`,
            {
                method: "DELETE"
            }
        );


        const result = await response.json();


        if (!response.ok) {

            alert(
                (result.errors || ["Could not delete complaint."])
                .join(", ")
            );

            return;
        }


        await loadComplaints();


    } catch (err) {

        alert(
            "Could not reach the server."
        );

    }

}


// ---------- Complaint Table ----------

function initComplaintsTable() {

    const tbody = document.getElementById(
        "complaintsBody"
    );

    if (!tbody) return;


    loadComplaints();


    const refreshBtn =
        document.querySelector(".refresh-btn");


    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            function () {

                loadComplaints();

            }
        );

    }


    const searchInput =
        document.getElementById("searchInput");


    const categoryFilter =
        document.getElementById("categoryFilter");


    const statusFilter =
        document.getElementById("statusFilter");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderComplaints
        );

    }


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            renderComplaints
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderComplaints
        );

    }

}


// ---------- Start Application ----------

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initComplaintForm();

        initComplaintsTable();

    }
);