import ProductionReadinessTests from './test-production-readiness';

async function runTests() {
  try {
    const results = await ProductionReadinessTests.runAllTests();
    
    // Write results to file for analysis
    const fs = await import('fs/promises');
    await fs.writeFile(
      'production-readiness-report.json',
      JSON.stringify(results, null, 2)
    );
    
    console.log('\n📝 Report saved to production-readiness-report.json');
    
    if (results.critical.length > 0) {
      console.log('\n⚠️ Critical issues must be resolved before production deployment!');
    }
    
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

runTests();