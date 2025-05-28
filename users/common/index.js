const database = require("../../index.js");
const { promisify } = require("util");
const queryAsync = promisify(database.query).bind(database);

exports.getAboutUs = async (req, res) => {
  const { role, role_id } = req.params;

  // Validate input
  if (!role || !role_id) {
    return res.status(400).json({ message: "role and role_id are required" });
  }

  try {
    // Define the query to fetch only the content
    const query = "SELECT content FROM about_us WHERE role = ? AND role_id = ?";

    // Execute the SQL query asynchronously using AsyncQuery
    const [results] = await queryAsync(query, [role, role_id]);
    // console.log(results)
    // Check if results were found
    if (!results) {
      return res
        .status(404)
        .json({ message: "No data found for the given role and role_id" });
    }

    // Return only the content
    return res.status(200).json({ content: results.content });
  } catch (error) {
    console.error("Error executing query:", error);
    return res
      .status(500)
      .json({ message: "Database error", error: error.message });
  }
};

exports.setAboutUs = async (req, res) => {
  const { role, role_id } = req.params;
  const { content } = req.body;

  if (!role || !role_id || !content) {
    return res
      .status(400)
      .json({ message: "role, role_id, and content are required" });
  }

  try {
    const query =
      "UPDATE about_us SET content = ? WHERE role = ? AND role_id = ?";

    const results = await queryAsync(query, [content, role, role_id]);

    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: "No data found to update for the given role and role_id",
      });
    }

    return res.status(200).json({ message: "Content updated successfully" });
  } catch (error) {
    console.error("Error executing query:", error);
    return res
      .status(500)
      .json({ message: "Database error", error: error.message });
  }
};

//Company Public View
exports.getPublicCompanyInfo = async (req, res) => {
  const { companyId } = req.params;

  try {
    const companyQuery = `
          SELECT companies.*, about_us.content AS about_us_content
          FROM companies 
          LEFT JOIN about_us ON companies.id = about_us.role_id AND about_us.role = 'company'
          WHERE companies.id = ?
      `;

    const [companyData] = await queryAsync(companyQuery, [companyId]);

    if (!companyData) {
      return res
        .status(404)
        .json({ message: "Company not found or not verified." });
    }

    // Initialize coreFields
    const coreFields = {
      id: companyData.id,
      name: companyData.name,
      email: companyData.email,
      sendbird_id: companyData.sendbird_id,
      createdAt: companyData.createdAt,
      updatedAt: companyData.updatedAt,
      verified: companyData.verified,
      emailToken: companyData.emailToken,
      profileUrl: companyData.profileUrl || "defaultImage.png",
      status: companyData.status,
      password: companyData.password, // Handle securely
      is_Active: companyData.is_Active,
      total_drivers: companyData.total_drivers,
      inactive_drivers: companyData.inactive_drivers,
      rating: companyData.rating || undefined,
      hourly_rate: companyData.hourly_rate,
      total_drives: companyData.total_drives,
      description: companyData.description,
      address: companyData.address || undefined,
      phone_no: companyData.contact || undefined,
      chat_id: companyData.chat_id,
      notification_id: companyData.notification_id,
      about_us_content: companyData.about_us_content || undefined,
    };

    // Extract skills by filtering out core fields
    const skills = Object.keys(companyData)
      .filter((key) => !coreFields.hasOwnProperty(key))
      .map((key) => ({
        skillName: key,
        value: companyData[key],
      }));

    //deleting the credentials fields
    delete coreFields.createdAt;
    delete coreFields.updatedAt;
    delete coreFields.verified;
    delete coreFields.emailToken;
    delete coreFields.password;
    delete coreFields.chat_id;
    delete coreFields.notification_id;

    // Return both coreFields and skills in a structured response
    res.status(200).json({ coreFields, skills });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching company information.", error });
  }
};

exports.getPublicOperatorInfo = async (req, res) => {
  const { operatorId } = req.params;

  try {
    const operatorQuery = `
          SELECT o.*, a.content AS about_us_content
          FROM operators o
          LEFT JOIN about_us a ON a.role = 'operator' AND a.role_id = o.id
          WHERE o.id = ? ;
      `;

    const [operatorData] = await queryAsync(operatorQuery, [operatorId]);

    if (!operatorData) {
      return res
        .status(404)
        .json({ message: "Operator not found or not verified." });
    }
    let coreFields = {
      name: operatorData.name,
      email: operatorData.email,
      profileUrl: operatorData.profileUrl || "defaultImage.png",
      address: operatorData.address || undefined,
      phone_no: operatorData.contact || undefined,
      description: operatorData.description,
      status: operatorData.status || undefined,
      rating: operatorData.rating || undefined,
      about_us_content: operatorData.about_us_content || undefined,
      isActive: operatorData.is_Active || undefined,
    };
    res.status(200).json(coreFields);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching operator information.", error });
  }
};




//Filters
exports.getAllFilters = async (req, res) => {
  try {
    // Define the query to select all filters
    const query = "SELECT * FROM Filters";

    // Execute the query using queryAsync
    const results = await queryAsync(query);
    console.log(results);
    // Send the results as a JSON response
    res.status(200).json(results);
  } catch (err) {
    // Log any SQL errors
    console.error("Error executing query:", err.message);

    // Respond with a 500 status code
    res.status(500).send("Error fetching filters");
  }
};