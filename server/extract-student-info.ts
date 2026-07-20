// Function to extract student information from PDF text
export interface ExtractedStudentInfo {
  name: string | null;
  email: string | null;
  programCohort: string | null;
  testDate: string | null;
  assessmentName: string | null;
  institutionProgram: string | null;
}

export function extractStudentInfoFromPDF(pdfText: string): ExtractedStudentInfo {
  const info: ExtractedStudentInfo = {
    name: null,
    email: null,
    programCohort: null,
    testDate: null,
    assessmentName: null,
    institutionProgram: null
  };

  // Split text into lines for easier parsing
  const lines = pdfText.split('\n').map(line => line.trim());
  
  // Extract student name - look for patterns like "Student:", "Name:", "Candidate:"
  for (let i = 0; i < lines.length && i < 50; i++) { // Check first 50 lines
    const line = lines[i];
    
    // Look for student name patterns
    if (line.includes('Student:') || line.includes('Name:') || line.includes('Candidate:')) {
      const nameMatch = line.match(/(?:Student|Name|Candidate):\s*(.+?)(?:\s{2,}|$)/i);
      if (nameMatch) {
        info.name = nameMatch[1].trim();
      }
    }
    
    // Also check for name in format "FirstName LastName" at beginning of document
    if (i < 10 && !info.name) {
      // Check if line looks like a name (2-3 words starting with capital letters)
      const potentialName = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})$/);
      if (potentialName) {
        info.name = potentialName[1];
      }
    }
    
    // Extract email if present
    const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      info.email = emailMatch[1];
    }
    
    // Extract program/cohort information
    if (line.includes('Program:') || line.includes('Cohort:')) {
      const programMatch = line.match(/(?:Program|Cohort):\s*(.+?)(?:\s{2,}|$)/i);
      if (programMatch) {
        info.programCohort = programMatch[1].trim();
      }
    }
    
    // Extract test date
    if (line.includes('Test Date:') || line.includes('Date:') || line.includes('Assessment Date:')) {
      const dateMatch = line.match(/(?:Test Date|Date|Assessment Date):\s*(.+?)(?:\s{2,}|$)/i);
      if (dateMatch) {
        info.testDate = dateMatch[1].trim();
      }
    }
    
    // Extract assessment name (e.g., "Comprehensive Predictor")
    if (line.includes('Assessment:') || line.includes('Test:') || line.includes('Exam:')) {
      const assessmentMatch = line.match(/(?:Assessment|Test|Exam):\s*(.+?)(?:\s{2,}|$)/i);
      if (assessmentMatch) {
        info.assessmentName = assessmentMatch[1].trim();
      }
    }
    
    // Look for ATI Comprehensive Predictor or similar assessment names
    if (line.includes('Comprehensive Predictor') || line.includes('Practice Assessment') || line.includes('Proctored Assessment')) {
      if (!info.assessmentName) {
        info.assessmentName = line.trim();
      }
    }
    
    // Extract institution/program name
    if (line.includes('Institution:') || line.includes('School:')) {
      const institutionMatch = line.match(/(?:Institution|School):\s*(.+?)(?:\s{2,}|$)/i);
      if (institutionMatch) {
        info.institutionProgram = institutionMatch[1].trim();
      }
    }
  }
  
  // If no name found, look for it in specific ATI report format
  if (!info.name) {
    // ATI reports sometimes have the name on its own line near the top
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i];
      // Look for a line that appears to be a name (starts with capital, 2-4 words)
      if (/^[A-Z][a-z]+(\s+[A-Z]['']?[a-z]+){1,3}$/.test(line)) {
        // Verify it's not a header or title
        const lowerLine = line.toLowerCase();
        if (!lowerLine.includes('report') && !lowerLine.includes('assessment') && 
            !lowerLine.includes('page') && !lowerLine.includes('comprehensive')) {
          info.name = line;
          break;
        }
      }
    }
  }
  
  return info;
}