import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExtractedTopic {
  name: string;
  bodySystem?: string;
  diagnosis?: string;
  setting?: string;
  population?: string;
  nclexCategory: string;
  description: string;
  source: string;
  confidence: number;
}

interface ExtractionResult {
  newTopicsAdded: ExtractedTopic[];
  existingTopicsFound: string[];
  totalExtracted: number;
  processingNotes: string[];
}

interface BookParsingResult {
  sectionsFound: number;
  topicsMapped: number;
  contentMappings: any[];
  unmappedSections: any[];
  processingNotes: string[];
}

export default function ATITopicExtractor() {
  const [reportText, setReportText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [bookResult, setBookResult] = useState<BookParsingResult | null>(null);
  const [contentType, setContentType] = useState<'ati' | 'reference'>('ati');
  const { toast } = useToast();

  const handleExtractTopics = async () => {
    if (!reportText.trim()) {
      toast({
        title: "Missing Input",
        description: contentType === 'ati' ? "Please paste ATI assessment report text" : "Please paste reference book content",
        variant: "destructive"
      });
      return;
    }

    setIsExtracting(true);
    setResult(null);
    setBookResult(null);
    
    try {
      if (contentType === 'ati') {
        const response = await apiRequest("POST", "/api/admin/extract-ati-topics", {
          reportText,
          reportId: `ati-report-${Date.now()}`
        });

        if (!response.ok) {
          throw new Error('Failed to extract topics');
        }

        const extractionResult = await response.json();
        setResult(extractionResult);
        
        toast({
          title: "Topics Extracted Successfully",
          description: `Found ${extractionResult.totalExtracted} topics, added ${extractionResult.newTopicsAdded.length} new ones`,
        });
      } else {
        const response = await apiRequest("POST", "/api/admin/parse-reference-book", {
          bookText: reportText,
          bookTitle: "Nursing Reference Book"
        });

        if (!response.ok) {
          throw new Error('Failed to parse reference book');
        }

        const parseResult = await response.json();
        setBookResult(parseResult);
        
        toast({
          title: "Reference Book Parsed Successfully",
          description: `Found ${parseResult.sectionsFound} sections, mapped ${parseResult.topicsMapped} to existing topics`,
        });
      }
    } catch (error) {
      console.error("Error processing content:", error);
      toast({
        title: "Processing Failed",
        description: contentType === 'ati' ? "Failed to extract topics from report" : "Failed to parse reference book",
        variant: "destructive"
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLoadSampleData = () => {
    if (contentType === 'ati') {
      const sampleText = `Topics To Review
Management of Care (1 item)
Collaboration with Multidisciplinary Team (1 item)
Making Interprofessional Referrals (Active Learning Template - Basic Concept)

Safety and Infection Control (5 items)
Standard Precautions/Transmission-Based Precautions/Surgical Asepsis (2 items)
Developing a Plan of Care for An Infant Who Has Respiratory Syncytial Virus (Active Learning Template - System Disorder)
Isolation Precautions for a Child Who Has Pertussis (Active Learning Template - System Disorder)
Home Safety (2 items)
Discharge Teaching About Infant Home Safety (Active Learning Template - System Disorder)
Teaching the Parents of a Toddler About Burn Prevention (Active Learning Template - Basic Concept)

Health Promotion and Maintenance (1 item)
Developmental Stages and Transitions (1 item)
Teaching Classroom Management Strategies for Children Who Have ADHD (Active Learning Template - System Disorder)

Psychosocial Integrity (1 item)
Grief and Loss (1 item)
Providing Interventions for Anticipatory Grieving (Active Learning Template - Basic Concept)

Basic Care and Comfort (2 items)
Nutrition and Oral Hydration (2 items)
Caring for an Infant Who Has a Nasojejunal Feeding Tube (Active Learning Template - Therapeutic Procedure)
Identifying Manifestations of Severe Dehydration (Active Learning Template - System Disorder)

Pharmacological and Parenteral Therapies (4 items)
Expected Actions/Outcomes (1 item)
Medication for a Child Who Has Cerebral Palsy and Muscle Spasms (Active Learning Template - System Disorder)
Medication Administration (2 items)
Administration of Otic Medication (Active Learning Template - Nursing Skill)
Discharge Teaching for Phenytoin Extended-Release Capsules (Active Learning Template - Medication)

Clinical Judgment (9 items)
Analyze Cues (3 items)
Gastrointestinal Structural and Inflammatory Disorders: Identifying Manifestations of Hypertrophic Pyloric Stenosis or Gastroesophageal Reflux (Active Learning Template - System Disorder)
Identifying Findings for a 6-Week-Old Infant That Require Follow-Up (Active Learning Template - System Disorder)`;
      
      setReportText(sampleText);
    } else {
      const sampleReferenceText = `HEAD-TO-TOE ASSESSMENT
Introduction                                                     Orientation                     "Normal" Vital Signs
1 INSPECT
2 PALPATE    ✹ Knock                                            ✹ What is your name?                          ✹ Pulse: 60-100 bpm
3 PERCUSS    ✹ Introduce yourself                               ✹ Do you know where you are?                  ✹ Blood Pressure: 120/80 mmHg
               Wash hands                                       ✹ Do you know what month it is?
4 AUSCULTATE ✹
                                                                                                              ✹ O2 Saturation: 95-100%
             ✹ Provide privacy                                  ✹ Who is the current U.S. president?
             ✹ Verify client ID and DOB                         ✹ What are you doing here?                    ✹ Temperature: 97.8-99.1°F
             ✹ Explain what you are doing                       ✹ A&O X4 = Oriented to Person,                ✹ Respirations: 12-20 breaths per min
                                   (using non-medical language)       Place, Time, and Situation

Head & Face
HEAD                                                                                            
✸ Inspect head/scalp/hair                                          VII: Facial                 
✸ Palpate head/scalp/hair                                        • Raise eyebrows
                                                                • Smile
                                                                • Frown
FACE                                                              • Show teeth
✸ Inspect                                                         • Puff out cheeks
                                                                • Tightly close eyes
✸ Check for symmetry
✸ To assess Cranial Nerve 7, check....                                                  

EYES
✸ Inspects external eye structures
✸ Inspect color of conjunctiva and sclera
✸ PERRLA
     • Pupils Equal, Round, Reactive to Light,
      & Accommodation

Neck, Chest (Lungs) & Heart
NECK
✸ Inspect and palpate
✸ Palpate carotid pulse
✸ Check skin turgor (under clavicle)

POSTERIOR CHEST
✸ Inspect
✸ Auscultate lung sounds in posterior and lateral chest
   • Note any crackles or diminished breath sounds

ANTERIOR CHEST
✸ Inspect:
   • Use of accessory muscles
   • AP to transverse diameter
   • Sternum configuration

BASIC CARE AND COMFORT
Nutrition and Oral Hydration
✸ Assess nutritional status
✸ Monitor fluid intake and output
✸ Assess for signs of dehydration
✸ Provide oral hygiene
✸ Assist with feeding as needed

Elimination
✸ Assess bowel and bladder function
✸ Monitor elimination patterns
✸ Provide privacy and comfort
✸ Assist with toileting needs

Mobility and Positioning
✸ Assess mobility and range of motion
✸ Provide position changes every 2 hours
✸ Use proper body mechanics
✸ Assist with ambulation and transfers`;
      
      setReportText(sampleReferenceText);
    }
  };

  return (
    <div className="container mx-auto py-8" data-testid="ati-topic-extractor">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Content Topic Extractor</h1>
        <p className="text-gray-600">
          Extract and map content from ATI assessment reports or nursing reference books to review topics
        </p>
        
        <div className="mt-4 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="contentType"
              value="ati"
              checked={contentType === 'ati'}
              onChange={(e) => setContentType(e.target.value as 'ati' | 'reference')}
              data-testid="radio-ati"
            />
            <span>ATI Assessment Report</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="contentType"
              value="reference"
              checked={contentType === 'reference'}
              onChange={(e) => setContentType(e.target.value as 'ati' | 'reference')}
              data-testid="radio-reference"
            />
            <span>Reference Book Content</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {contentType === 'ati' ? 'ATI Assessment Report Text' : 'Reference Book Content'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={contentType === 'ati' 
                  ? "Paste ATI assessment report 'Topics To Review' section here..."
                  : "Paste nursing reference book content here..."
                }
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                rows={15}
                className="min-h-[300px]"
                data-testid="input-report-text"
              />
              
              <div className="flex gap-2">
                <Button
                  onClick={handleExtractTopics}
                  disabled={isExtracting}
                  data-testid="button-extract-topics"
                >
                  {isExtracting 
                    ? (contentType === 'ati' ? "Extracting..." : "Parsing...") 
                    : (contentType === 'ati' ? "Extract Topics" : "Parse Content")
                  }
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleLoadSampleData}
                  data-testid="button-load-sample"
                >
                  Load Sample Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {/* ATI Results */}
          {result && contentType === 'ati' && (
            <>
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Extraction Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Extracted:</span>
                      <span className="ml-2 font-medium" data-testid="stat-total-extracted">
                        {result.totalExtracted}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">New Topics Added:</span>
                      <span className="ml-2 font-medium text-green-600" data-testid="stat-new-added">
                        {result.newTopicsAdded.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Existing Found:</span>
                      <span className="ml-2 font-medium text-blue-600" data-testid="stat-existing-found">
                        {result.existingTopicsFound.length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* New Topics Added */}
              {result.newTopicsAdded.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">New Topics Added</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.newTopicsAdded.map((topic, index) => (
                        <div 
                          key={index} 
                          className="p-3 border rounded-lg bg-green-50"
                          data-testid={`new-topic-${index}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{topic.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {(topic.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            {topic.population && (
                              <div>
                                <span className="font-medium">Population:</span> {topic.population}
                              </div>
                            )}
                            {topic.diagnosis && (
                              <div>
                                <span className="font-medium">Diagnosis:</span> {topic.diagnosis}
                              </div>
                            )}
                            {topic.bodySystem && (
                              <div>
                                <span className="font-medium">Body System:</span> {topic.bodySystem}
                              </div>
                            )}
                            {topic.setting && (
                              <div>
                                <span className="font-medium">Setting:</span> {topic.setting}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">NCLEX:</span> {topic.nclexCategory}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Existing Topics Found */}
              {result.existingTopicsFound.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600">Existing Topics Found</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.existingTopicsFound.map((topicName, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="text-xs"
                          data-testid={`existing-topic-${index}`}
                        >
                          {topicName}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Processing Notes */}
              {result.processingNotes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Processing Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.processingNotes.map((note, index) => (
                        <Alert key={index}>
                          <AlertDescription className="text-sm">
                            {note}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Reference Book Results */}
          {bookResult && contentType === 'reference' && (
            <>
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Reference Book Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Sections Found:</span>
                      <span className="ml-2 font-medium" data-testid="stat-sections-found">
                        {bookResult.sectionsFound}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Topics Mapped:</span>
                      <span className="ml-2 font-medium text-green-600" data-testid="stat-topics-mapped">
                        {bookResult.topicsMapped}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Content Mappings:</span>
                      <span className="ml-2 font-medium text-blue-600" data-testid="stat-content-mappings">
                        {bookResult.contentMappings.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unmapped Sections:</span>
                      <span className="ml-2 font-medium text-orange-600" data-testid="stat-unmapped">
                        {bookResult.unmappedSections.length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Mappings */}
              {bookResult.contentMappings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">Content Mapped to Topics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {bookResult.contentMappings.map((mapping, index) => (
                        <div 
                          key={index} 
                          className="p-3 border rounded-lg bg-green-50"
                          data-testid={`content-mapping-${index}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{mapping.topicName}</h4>
                            <Badge variant="outline" className="text-xs">
                              {(mapping.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>
                              <span className="font-medium">Content Type:</span> {mapping.contentType}
                            </div>
                            <div>
                              <span className="font-medium">Sections:</span> {mapping.relevantSections.length}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Processing Notes */}
              {bookResult.processingNotes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Processing Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {bookResult.processingNotes.map((note, index) => (
                        <Alert key={index}>
                          <AlertDescription className="text-sm">
                            {note}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!result && !bookResult && (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p>
                  Paste {contentType === 'ati' ? 'ATI assessment report text' : 'reference book content'} and click "{contentType === 'ati' ? 'Extract Topics' : 'Parse Content'}" to see results
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}