const stateCityMap = {
    punjab: ["Amritsar", "Ludhiana", "Jalandhar", "Patiala"],
    himachal: ["Manali", "Shimla", "Dharamshala"],
    uttarakhand: ["Dehradun", "Nainital", "Rishikesh", "Mussoorie"],
    rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Jaisalmer"],
    kerala: ["Kochi", "Munnar", "Alleppey", "Thiruvananthapuram"],
    goa: ["Panaji", "Calangute", "Margao", "Vasco da Gama"],
    maharashtra: ["Mumbai", "Pune", "Nashik", "Aurangabad"],
    karnataka: ["Bangalore", "Mysore", "Coorg", "Hampi"],
    "tamil nadu": ["Chennai", "Madurai", "Ooty", "Coimbatore"],
    gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rann of Kutch"],
    "west bengal": ["Kolkata", "Darjeeling", "Siliguri", "Sundarbans"],
    "uttar pradesh": ["Agra", "Varanasi", "Lucknow", "Mathura"],
    "jammu and kashmir": ["Srinagar", "Gulmarg", "Pahalgam", "Leh"],
    ladakh: ["Leh", "Nubra Valley", "Pangong", "Zanskar"],
    assam: ["Guwahati", "Kaziranga", "Jorhat", "Tezpur"],
};

export function resolveLocation(input) {
 
    const key = input.trim().toLowerCase();

    if (stateCityMap[key]) {
        return {
            type: "state",
            cities: stateCityMap[key]
        };
    }

    // Capitalize first letter for city names
    const formatted = input.trim().charAt(0).toUpperCase() + input.trim().slice(1);
    return {
        type: "city",
        cities: [formatted]
    };
}