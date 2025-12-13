import { supabase } from "./postgresql.js";

 
async function intializeDB() : Promise<void>{
    const { error }  = await supabase.from('users').select('*').limit(1);
    if(error){
        console.log("Error initializing database:", error);
        return;
    }

    console.log("PostgreSQL Database initialized successfully.");
    return;
}

export { intializeDB };