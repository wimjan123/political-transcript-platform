#!/usr/bin/env python3
"""
Search Performance Testing Script
Compares optimized Meilisearch vs legacy PostgreSQL search
"""
import asyncio
import time
import httpx
import json
from typing import Dict, Any, List

BASE_URL = "http://localhost:8000"
TEST_QUERIES = [
    "trump",
    "economy", 
    "healthcare",
    "immigration",
    "biden",
    "election",
    "democracy",
    "foreign policy",
    "climate change",
    "infrastructure"
]

class SearchPerformanceTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.results = {
            "optimized": [],
            "legacy": []
        }
    
    async def test_search_endpoint(
        self, 
        endpoint: str, 
        query: str,
        page_size: int = 25
    ) -> Dict[str, Any]:
        """Test a single search endpoint"""
        start_time = time.time()
        
        try:
            response = await self.client.get(
                f"{BASE_URL}/{endpoint}",
                params={
                    "q": query,
                    "page": 1,
                    "page_size": page_size
                }
            )
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "query": query,
                    "endpoint": endpoint,
                    "status": "success",
                    "response_time_ms": round(response_time, 2),
                    "total_results": data.get("total", 0),
                    "returned_results": len(data.get("results", [])),
                    "has_highlighting": self._check_highlighting(data.get("results", [])),
                    "processing_time_ms": data.get("processing_time_ms", 0),
                    "search_engine": data.get("search_engine", "unknown")
                }
            else:
                return {
                    "query": query,
                    "endpoint": endpoint,
                    "status": "error",
                    "response_time_ms": round(response_time, 2),
                    "error": f"HTTP {response.status_code}: {response.text[:200]}"
                }
                
        except Exception as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            return {
                "query": query,
                "endpoint": endpoint, 
                "status": "failed",
                "response_time_ms": round(response_time, 2),
                "error": str(e)
            }
    
    def _check_highlighting(self, results: List[Dict]) -> bool:
        """Check if results contain highlighting markup"""
        for result in results[:3]:  # Check first 3 results
            text = result.get("transcript_text", "")
            if "<mark>" in text or result.get("highlighted", False):
                return True
        return False
    
    async def run_performance_comparison(self) -> Dict[str, Any]:
        """Run comprehensive performance comparison"""
        print("🚀 Starting Search Performance Testing...")
        print("=" * 50)
        
        # Test both endpoints
        for query in TEST_QUERIES:
            print(f"\nTesting query: '{query}'")
            
            # Test optimized search
            optimized_result = await self.test_search_endpoint(
                "api/search", query
            )
            self.results["optimized"].append(optimized_result)
            print(f"  ✅ Optimized: {optimized_result['response_time_ms']}ms")
            
            # Test legacy search
            legacy_result = await self.test_search_endpoint(
                "api/search-legacy", query
            )
            self.results["legacy"].append(legacy_result)
            print(f"  📊 Legacy: {legacy_result['response_time_ms']}ms")
            
            # Show improvement
            if (optimized_result['status'] == 'success' and 
                legacy_result['status'] == 'success'):
                speedup = legacy_result['response_time_ms'] / optimized_result['response_time_ms']
                print(f"  🎯 Speedup: {speedup:.1f}x faster")
            
            # Small delay between queries
            await asyncio.sleep(0.5)
        
        return self._generate_report()
    
    def _generate_report(self) -> Dict[str, Any]:
        """Generate performance comparison report"""
        optimized_times = [r['response_time_ms'] for r in self.results["optimized"] 
                          if r['status'] == 'success']
        legacy_times = [r['response_time_ms'] for r in self.results["legacy"] 
                       if r['status'] == 'success']
        
        if not optimized_times or not legacy_times:
            return {"error": "Insufficient successful queries for comparison"}
        
        # Calculate statistics
        optimized_avg = sum(optimized_times) / len(optimized_times)
        legacy_avg = sum(legacy_times) / len(legacy_times)
        speedup_avg = legacy_avg / optimized_avg if optimized_avg > 0 else 0
        
        # Check highlighting
        optimized_highlighting = sum(1 for r in self.results["optimized"] 
                                   if r.get('has_highlighting', False))
        legacy_highlighting = sum(1 for r in self.results["legacy"] 
                                if r.get('has_highlighting', False))
        
        return {
            "summary": {
                "total_queries_tested": len(TEST_QUERIES),
                "average_response_time": {
                    "optimized_ms": round(optimized_avg, 2),
                    "legacy_ms": round(legacy_avg, 2),
                    "improvement": f"{speedup_avg:.1f}x faster"
                },
                "highlighting_support": {
                    "optimized": f"{optimized_highlighting}/{len(optimized_times)} queries",
                    "legacy": f"{legacy_highlighting}/{len(legacy_times)} queries"
                },
                "reliability": {
                    "optimized_success_rate": f"{len(optimized_times)}/{len(self.results['optimized'])}",
                    "legacy_success_rate": f"{len(legacy_times)}/{len(self.results['legacy'])}"
                }
            },
            "detailed_results": {
                "optimized": self.results["optimized"],
                "legacy": self.results["legacy"]
            },
            "recommendations": self._get_recommendations(speedup_avg, optimized_highlighting, legacy_highlighting)
        }
    
    def _get_recommendations(self, speedup: float, opt_highlighting: int, leg_highlighting: int) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        if speedup > 2.0:
            recommendations.append("✅ Significant performance improvement detected - deploy optimized search")
        elif speedup > 1.2:
            recommendations.append("⚡ Moderate performance improvement - consider deploying")
        else:
            recommendations.append("⚠️ Limited performance improvement - investigate configuration")
        
        if opt_highlighting > leg_highlighting:
            recommendations.append("✨ Highlighting functionality improved - better user experience")
        
        if speedup > 5.0:
            recommendations.append("🚀 Exceptional performance gain - immediate deployment recommended")
        
        return recommendations
    
    async def test_large_result_sets(self) -> Dict[str, Any]:
        """Test handling of large result sets"""
        print("\n🔍 Testing Large Result Set Handling...")
        
        large_queries = ["the", "and", "to", "of"]  # Common words likely to return many results
        large_results = {"optimized": [], "legacy": []}
        
        for query in large_queries:
            print(f"Testing large results for: '{query}'")
            
            # Test with large page size
            opt_result = await self.test_search_endpoint("api/search", query, page_size=100)
            leg_result = await self.test_search_endpoint("api/search-legacy", query, page_size=100)
            
            large_results["optimized"].append(opt_result)
            large_results["legacy"].append(leg_result)
            
            print(f"  Optimized: {opt_result.get('response_time_ms', 'N/A')}ms")
            print(f"  Legacy: {leg_result.get('response_time_ms', 'N/A')}ms")
        
        return large_results
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()

async def main():
    """Main testing function"""
    tester = SearchPerformanceTester()
    
    try:
        # Run performance comparison
        report = await tester.run_performance_comparison()
        
        # Test large result sets
        large_test = await tester.test_large_result_sets()
        
        # Print comprehensive report
        print("\n" + "="*50)
        print("📊 PERFORMANCE TESTING COMPLETE")
        print("="*50)
        
        print(f"\n📈 Summary:")
        summary = report.get("summary", {})
        print(f"  • Queries tested: {summary.get('total_queries_tested', 0)}")
        
        avg_times = summary.get("average_response_time", {})
        print(f"  • Optimized avg: {avg_times.get('optimized_ms', 'N/A')}ms")
        print(f"  • Legacy avg: {avg_times.get('legacy_ms', 'N/A')}ms") 
        print(f"  • Improvement: {avg_times.get('improvement', 'N/A')}")
        
        highlight = summary.get("highlighting_support", {})
        print(f"  • Optimized highlighting: {highlight.get('optimized', 'N/A')}")
        print(f"  • Legacy highlighting: {highlight.get('legacy', 'N/A')}")
        
        print(f"\n💡 Recommendations:")
        for rec in report.get("recommendations", []):
            print(f"  {rec}")
        
        # Save detailed report
        with open("search_performance_report.json", "w") as f:
            json.dump({
                "performance_comparison": report,
                "large_result_test": large_test,
                "timestamp": time.time()
            }, f, indent=2)
        
        print(f"\n📝 Detailed report saved to: search_performance_report.json")
        
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())